<template>
    <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("Scan Kubernetes Namespace") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                </div>

                <form @submit.prevent="submit">
                    <div class="modal-body">
                        <p class="text-muted">
                            {{ $t("kubernetesScanDescription") }}
                        </p>

                        <div class="mb-3">
                            <label for="k8s-namespace" class="form-label">{{ $t("Namespace") }}</label>
                            <input
                                id="k8s-namespace"
                                v-model="namespace"
                                type="text"
                                class="form-control"
                                placeholder="default"
                                required
                                :disabled="processing"
                            />
                        </div>

                        <div v-if="result" class="alert" :class="result.ok ? 'alert-success' : 'alert-danger'">
                            {{ result.msg }}
                            <ul v-if="result.createdNames && result.createdNames.length" class="mb-0 mt-2">
                                <li v-for="name in result.createdNames" :key="name">{{ name }}</li>
                            </ul>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary" :disabled="processing">
                            <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
                            {{ $t("Scan and Register") }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    data() {
        return {
            modal: null,
            processing: false,
            namespace: "",
            result: null,
        };
    },

    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },

    methods: {
        /**
         * Show the dialog, resetting any previous scan result
         * @returns {void}
         */
        show() {
            this.namespace = "";
            this.result = null;
            this.processing = false;
            this.modal.show();
        },

        /**
         * Scan the entered namespace and register any newly-discovered services
         * @returns {void}
         */
        submit() {
            this.processing = true;
            this.result = null;
            this.$root.getSocket().emit("scanKubernetesNamespace", this.namespace, (res) => {
                this.processing = false;
                this.result = res;
                this.$root.toastRes(res);
            });
        },
    },
};
</script>
