const k8s = require("@kubernetes/client-node");

// Ports whose number alone is a strong enough hint that the service speaks HTTP,
// used only when the port's own name doesn't already say so.
const COMMON_HTTP_PORTS = [80, 8080, 8000, 8081, 3000, 5000, 9000, 9090];
const COMMON_HTTPS_PORTS = [443, 8443];

class KubernetesNamespaceScanner {
    /**
     * Build a CoreV1 API client from the ambient Kubernetes credentials: the
     * mounted ServiceAccount token when running inside a cluster, or the local
     * kubeconfig file otherwise.
     * @returns {k8s.CoreV1Api} Kubernetes CoreV1 API client
     * @throws {Error} If no Kubernetes credentials could be found
     */
    static getClient() {
        const kc = new k8s.KubeConfig();

        try {
            kc.loadFromDefault();
        } catch (e) {
            throw new Error(
                "Unable to load Kubernetes credentials. Uptime Komo must be running inside the target " +
                    "Kubernetes cluster (with a ServiceAccount) or have a valid kubeconfig available."
            );
        }

        return kc.makeApiClient(k8s.CoreV1Api);
    }

    /**
     * Heuristically classify a Service port as HTTP(S) or a plain TCP port, based
     * on its name first (e.g. "http", "web", "https"), then falling back to
     * well-known port numbers.
     * @param {object} port Kubernetes ServicePort {name, port, protocol}
     * @returns {"http"|"https"|"tcp"} Detected scheme
     */
    static classifyPort(port) {
        const name = (port.name || "").toLowerCase();

        if (name.includes("https")) {
            return "https";
        }
        if (name.includes("http") || name.includes("web")) {
            return "http";
        }
        if (COMMON_HTTPS_PORTS.includes(port.port)) {
            return "https";
        }
        if (COMMON_HTTP_PORTS.includes(port.port)) {
            return "http";
        }
        return "tcp";
    }

    /**
     * List every Service in a namespace, with each of its ports classified as
     * http/https/tcp so they can be turned into monitors.
     * @param {string} namespace Kubernetes namespace to scan
     * @returns {Promise<Array<object>>} Discovered services: {name, namespace, hostname, ports}
     */
    static async scanNamespace(namespace) {
        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(namespace)) {
            throw new Error("Invalid namespace name.");
        }

        const client = KubernetesNamespaceScanner.getClient();

        let serviceList;
        try {
            serviceList = await client.listNamespacedService({ namespace });
        } catch (e) {
            throw new Error(`Unable to list services in namespace "${namespace}": ${e.message}`);
        }

        const services = [];

        for (const service of serviceList.items) {
            const spec = service.spec || {};

            // Headless services (no ClusterIP) and ExternalName services have no
            // cluster-internal address that can be monitored directly.
            if (!spec.clusterIP || spec.clusterIP === "None" || spec.type === "ExternalName") {
                continue;
            }

            const ports = (spec.ports || [])
                .filter((port) => port.port)
                .map((port) => ({
                    name: port.name || String(port.port),
                    port: port.port,
                    scheme: KubernetesNamespaceScanner.classifyPort(port),
                }));

            if (ports.length === 0) {
                continue;
            }

            services.push({
                name: service.metadata.name,
                namespace,
                hostname: `${service.metadata.name}.${namespace}.svc.cluster.local`,
                ports,
            });
        }

        return services;
    }
}

module.exports = {
    KubernetesNamespaceScanner,
};
