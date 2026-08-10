const { R } = require("redbean-node");
const { log } = require("../src/util");
const Discord = require("./notification-providers/discord");
const Ntfy = require("./notification-providers/ntfy");
const Slack = require("./notification-providers/slack");
const Teams = require("./notification-providers/teams");
const Telegram = require("./notification-providers/telegram");
const Webhook = require("./notification-providers/webhook");
const Whapi = require("./notification-providers/whapi");
const WAHA = require("./notification-providers/waha");
const OpenWa = require("./notification-providers/openwa");
const Onesender = require("./notification-providers/onesender");
const SendGrid = require("./notification-providers/send-grid");
const { commandExists } = require("./util-server");

class Notification {
    providerList = {};

    /**
     * Initialize the notification providers
     * @returns {void}
     * @throws Notification provider does not have a name
     * @throws Duplicate notification providers in list
     */
    static init() {
        log.debug("notification", "Prepare Notification Providers");

        this.providerList = {};

        const list = [
            new Discord(),
            new Ntfy(),
            new Onesender(),
            new Slack(),
            new Teams(),
            new Telegram(),
            new Webhook(),
            new Whapi(),
            new WAHA(),
            new OpenWa(),
            new SendGrid(),
        ];
        for (let item of list) {
            if (!item.name) {
                throw new Error("Notification provider without name");
            }

            if (this.providerList[item.name]) {
                throw new Error("Duplicate notification provider name");
            }
            this.providerList[item.name] = item;
        }
    }

    /**
     * Send a notification
     * @param {BeanModel} notification Notification to send
     * @param {string} msg General Message
     * @param {object} monitorJSON Monitor details (For Up/Down only)
     * @param {object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Successful msg
     * @throws Error with fail msg
     */
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        if (this.providerList[notification.type]) {
            return this.providerList[notification.type].send(notification, msg, monitorJSON, heartbeatJSON);
        } else {
            throw new Error("Notification type is not supported");
        }
    }

    /**
     * Save a notification
     * @param {object} notification Notification to save
     * @param {?number} notificationID ID of notification to update
     * @param {number} userID ID of user who adds notification
     * @returns {Promise<Bean>} Notification that was saved
     */
    static async save(notification, notificationID, userID) {
        let bean;

        if (notificationID) {
            bean = await R.findOne("notification", " id = ? AND user_id = ? ", [notificationID, userID]);

            if (!bean) {
                throw new Error("notification not found");
            }
        } else {
            bean = R.dispense("notification");
        }

        // applyExisting is one time only, don't save it to database.
        const applyExisting = notification.applyExisting || false;
        notification.applyExisting = false;

        bean.name = notification.name;
        bean.user_id = userID;
        bean.config = JSON.stringify(notification);
        bean.is_default = notification.isDefault || false;
        await R.store(bean);

        if (applyExisting) {
            await applyNotificationEveryMonitor(bean.id, userID);
        }

        return bean;
    }

    /**
     * Delete a notification
     * @param {number} notificationID ID of notification to delete
     * @param {number} userID ID of user who created notification
     * @returns {Promise<void>}
     */
    static async delete(notificationID, userID) {
        let bean = await R.findOne("notification", " id = ? AND user_id = ? ", [notificationID, userID]);

        if (!bean) {
            throw new Error("notification not found");
        }

        await R.trash(bean);
    }

    /**
     * Check if apprise exists
     * @returns {Promise<boolean>} Does the command apprise exist?
     */
    static async checkApprise() {
        return await commandExists("apprise");
    }
}

/**
 * Apply the notification to every monitor
 * @param {number} notificationID ID of notification to apply
 * @param {number} userID ID of user who created notification
 * @returns {Promise<void>}
 */
async function applyNotificationEveryMonitor(notificationID, userID) {
    let monitors = await R.getAll("SELECT id FROM monitor WHERE user_id = ?", [userID]);

    for (let i = 0; i < monitors.length; i++) {
        let checkNotification = await R.findOne("monitor_notification", " monitor_id = ? AND notification_id = ? ", [
            monitors[i].id,
            notificationID,
        ]);

        if (!checkNotification) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitors[i].id;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

module.exports = {
    Notification,
};
