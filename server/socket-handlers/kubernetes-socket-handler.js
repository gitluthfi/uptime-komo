const { R } = require("redbean-node");
const { checkLogin } = require("../util-server");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { KubernetesNamespaceScanner } = require("../kubernetes");
const { log } = require("../../src/util");

// Fields shared by every auto-created monitor, mirroring the frontend's own
// defaults for a new monitor (src/pages/EditMonitor.vue's monitorDefaults) so
// they pass the same validation and behave the same as a manually-created one.
// The *_json-backed fields are pre-stringified here since bean.import() stores
// them as-is (the "add" socket handler does this same conversion at request time;
// these values never vary per-service, so it's done once, ahead of time).
const monitorFieldDefaults = {
    parent: null,
    method: "GET",
    protocol: null,
    location: "world",
    ipFamily: null,
    interval: 60,
    retryInterval: 60,
    resendInterval: 0,
    maxretries: 0,
    retryOnlyOnStatusCodeFailure: false,
    ignoreTls: false,
    upsideDown: false,
    expiryNotification: false,
    domainExpiryNotification: true,
    maxredirects: 10,
    accepted_statuscodes_json: JSON.stringify(["200-299"]),
    saveResponse: false,
    saveErrorResponse: true,
    responseMaxLength: 1024,
    dns_resolve_type: "A",
    dns_resolve_server: "",
    docker_container: "",
    docker_host: null,
    proxyId: null,
    basic_auth_user: "",
    basic_auth_pass: "",
    bearer_token: "",
    authMethod: null,
    httpBodyEncoding: "json",
    kafkaProducerBrokers: JSON.stringify([]),
    kafkaProducerSaslOptions: JSON.stringify({ mechanism: "None" }),
    cacheBust: false,
    kafkaProducerSsl: false,
    kafkaProducerAllowAutoTopicCreation: false,
    rabbitmqNodes: JSON.stringify([]),
    rabbitmqUsername: "",
    rabbitmqPassword: "",
    conditions: JSON.stringify([]),
    system_service_name: "",
};

/**
 * Build a monitor definition object for one discovered Service port.
 * @param {object} service Discovered service {name, namespace, hostname}
 * @param {object} port Classified port {name, port, scheme}
 * @param {boolean} multiPort Whether the service exposes more than one port
 * @returns {object} Monitor definition, ready for bean.import()
 */
function buildMonitorFromServicePort(service, port, multiPort) {
    const name = multiPort
        ? `${service.name}.${service.namespace}:${port.name}`
        : `${service.name}.${service.namespace}`;

    if (port.scheme === "http" || port.scheme === "https") {
        return {
            ...monitorFieldDefaults,
            type: "http",
            name,
            url: `${port.scheme}://${service.hostname}:${port.port}/`,
        };
    }

    return {
        ...monitorFieldDefaults,
        type: "port",
        name,
        hostname: service.hostname,
        port: port.port,
    };
}

/**
 * Handler for scanning a Kubernetes namespace and auto-registering its
 * Services as monitors ("semi-automatic" monitor onboarding).
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.kubernetesSocketHandler = (socket) => {
    socket.on("scanKubernetesNamespace", async (namespace, callback) => {
        try {
            checkLogin(socket);

            if (!namespace || typeof namespace !== "string" || !namespace.trim()) {
                throw new Error("Namespace is required.");
            }

            const services = await KubernetesNamespaceScanner.scanNamespace(namespace.trim());

            if (services.length === 0) {
                callback({
                    ok: true,
                    msg: `No monitorable services found in namespace "${namespace.trim()}".`,
                    created: 0,
                    skipped: 0,
                    createdNames: [],
                });
                return;
            }

            const server = UptimeKumaServer.getInstance();

            // Auto-created monitors get the user's default-enabled notifications,
            // same as a monitor created through the normal "Add Monitor" form.
            const defaultNotificationIDList = await R.getCol(
                "SELECT id FROM notification WHERE user_id = ? AND is_default = 1",
                [socket.userID]
            );

            let created = 0;
            let skipped = 0;
            const createdNames = [];

            for (const service of services) {
                const multiPort = service.ports.length > 1;

                for (const port of service.ports) {
                    const monitorObj = buildMonitorFromServicePort(service, port, multiPort);

                    const existing = await R.findOne("monitor", " user_id = ? AND name = ? ", [
                        socket.userID,
                        monitorObj.name,
                    ]);

                    if (existing) {
                        skipped++;
                        continue;
                    }

                    let bean = R.dispense("monitor");
                    bean.import(monitorObj);
                    bean.user_id = socket.userID;
                    bean.validate();
                    await R.store(bean);

                    for (const notificationID of defaultNotificationIDList) {
                        let relation = R.dispense("monitor_notification");
                        relation.monitor_id = bean.id;
                        relation.notification_id = notificationID;
                        await R.store(relation);
                    }

                    server.monitorList[bean.id] = bean;
                    await bean.start(server.io);

                    created++;
                    createdNames.push(monitorObj.name);
                }
            }

            await server.sendMonitorList(socket);

            log.info(
                "kubernetes",
                `Namespace scan "${namespace.trim()}" by User ID: ${socket.userID}: ` +
                    `${created} created, ${skipped} skipped`
            );

            callback({
                ok: true,
                msg: `Scan complete: ${created} monitor(s) created, ${skipped} already existed.`,
                created,
                skipped,
                createdNames,
            });
        } catch (e) {
            log.error("kubernetes", e);

            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
