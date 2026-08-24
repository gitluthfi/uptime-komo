<template>
    <div>
        <StatusPage v-if="statusPageSlug" :override-slug="statusPageSlug" />
    </div>
</template>

<script>
import axios from "axios";
import StatusPage from "./StatusPage.vue";

export default {
    components: {
        StatusPage,
    },
    data() {
        return {
            statusPageSlug: null,
        };
    },
    async mounted() {
        // Server-rendered status page routes (e.g. /status/:slug, /status-page) are
        // real paths with no hash, so the hash-based router never matches them and
        // falls through to this default route. Render the status page directly
        // instead of asking the entry-page API where to go.
        // Vue Router's hash history rewrites location.pathname back to its own base
        // once it initializes, so use the path stashed before that happened.
        const initialPathname = window.__uptimeKomoInitialPathname || location.pathname;
        const slugMatch = initialPathname.match(/\/status\/([^/]+)\/?$/);
        if (slugMatch) {
            this.statusPageSlug = slugMatch[1];
            return;
        }
        if (/\/status(-page)?\/?$/.test(initialPathname)) {
            this.statusPageSlug = "default";
            return;
        }

        // There are only 3 cases that could come in here.
        // 1. Matched status Page domain name
        // 2. Vue Frontend Dev
        // 3. Vue Frontend Dev (not setup database yet)
        let res;
        try {
            res = (await axios.get("/api/entry-page")).data;

            if (res.type === "statusPageMatchedDomain") {
                this.statusPageSlug = res.statusPageSlug;
                this.$root.forceStatusPageTheme = true;
            } else if (res.type === "entryPage") {
                // Dev only. For production, the logic is in the server side
                const entryPage = res.entryPage;
                if (entryPage?.startsWith("statusPage-")) {
                    this.$router.push("/status/" + entryPage.replace("statusPage-", ""));
                } else {
                    // should the old setting style still exist here?
                    this.$router.push("/dashboard");
                }
            } else if (res.type === "setup-database") {
                this.$router.push("/setup-database");
            } else {
                this.$router.push("/dashboard");
            }
        } catch (e) {
            alert("Cannot connect to the backend server. Did you start the backend server? (npm run start-server-dev)");
        }
    },
};
</script>
