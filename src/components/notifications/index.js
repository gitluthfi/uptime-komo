import Discord from "./Discord.vue";
import Ntfy from "./Ntfy.vue";
import Onesender from "./Onesender.vue";
import Slack from "./Slack.vue";
import Teams from "./Teams.vue";
import Telegram from "./Telegram.vue";
import Webhook from "./Webhook.vue";
import Whapi from "./Whapi.vue";
import WAHA from "./WAHA.vue";
import OpenWa from "./OpenWa.vue";
import SendGrid from "./SendGrid.vue";

/**
 * Manage all notification form.
 * @type { Record<string, any> }
 */
const NotificationFormList = {
    discord: Discord,
    ntfy: Ntfy,
    Onesender: Onesender,
    slack: Slack,
    teams: Teams,
    telegram: Telegram,
    webhook: Webhook,
    whapi: Whapi,
    openwa: OpenWa,
    waha: WAHA,
    SendGrid: SendGrid,
};

export default NotificationFormList;
