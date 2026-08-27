<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="!$root.isMobile" class="col-12 col-md-5 col-xl-4 ps-0">
                <div class="d-flex gap-2 mb-3">
                    <router-link to="/add" class="btn btn-primary">
                        <font-awesome-icon icon="plus" />
                        {{ $t("Add New Monitor") }}
                    </router-link>
                    <button
                        type="button"
                        class="btn btn-normal"
                        @click="$refs.kubernetesScanDialog.show()"
                    >
                        <font-awesome-icon icon="search" />
                        {{ $t("Scan Kubernetes Namespace") }}
                    </button>
                </div>
                <MonitorList :scrollbar="true" />
            </div>

            <div ref="container" class="col-12 col-md-7 col-xl-8 mb-3 gx-0">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>

        <KubernetesScanDialog ref="kubernetesScanDialog" />
    </div>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";
import KubernetesScanDialog from "../components/KubernetesScanDialog.vue";

export default {
    components: {
        MonitorList,
        KubernetesScanDialog,
    },
    data() {
        return {
            height: 0,
        };
    },
    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
