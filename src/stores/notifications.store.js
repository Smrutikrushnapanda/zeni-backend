const notificationsByUser = new Map();
const devicesByUser = new Map();

const ensureUserList = (userId) => {
  if (!notificationsByUser.has(userId)) {
    notificationsByUser.set(userId, []);
  }
  return notificationsByUser.get(userId);
};

const getAllUserIds = () => {
  const ids = new Set();
  for (const userId of devicesByUser.keys()) ids.add(userId);
  for (const userId of notificationsByUser.keys()) ids.add(userId);
  return Array.from(ids);
};

const registerDevice = ({ userId, token, platform }) => {
  if (!userId || !token) return null;

  const existing = devicesByUser.get(userId) || [];
  const filtered = existing.filter((device) => device.token !== token);

  filtered.push({
    token,
    platform: platform || "unknown",
    updatedAt: new Date().toISOString(),
  });

  devicesByUser.set(userId, filtered);
  return filtered;
};

const getDeviceTokensForUsers = (userIds) => {
  const tokens = [];
  for (const userId of userIds) {
    const devices = devicesByUser.get(userId) || [];
    for (const device of devices) {
      tokens.push(device.token);
    }
  }
  return tokens;
};

const getAllDeviceTokens = () => {
  const tokens = [];
  for (const devices of devicesByUser.values()) {
    for (const device of devices) {
      tokens.push(device.token);
    }
  }
  return tokens;
};

const addNotificationsForUsers = (userIds, notification) => {
  const targetIds = userIds?.length ? userIds : getAllUserIds();
  const created = [];

  for (const userId of targetIds) {
    const list = ensureUserList(userId);
    const entry = {
      ...notification,
      read: false,
    };
    list.unshift(entry);
    created.push({ userId, notification: entry });
  }

  return created;
};

const getNotifications = (userId, { unreadOnly = false, limit = 50 } = {}) => {
  const list = ensureUserList(userId);
  const filtered = unreadOnly ? list.filter((item) => !item.read) : list;
  return filtered.slice(0, limit);
};

const markRead = (userId, notificationId) => {
  const list = ensureUserList(userId);
  const item = list.find((n) => n.id === notificationId);
  if (!item) return null;
  item.read = true;
  item.readAt = new Date().toISOString();
  return item;
};

const markAllRead = (userId) => {
  const list = ensureUserList(userId);
  const now = new Date().toISOString();
  list.forEach((item) => {
    item.read = true;
    item.readAt = now;
  });
  return list.length;
};

const getUnreadCount = (userId) => {
  const list = ensureUserList(userId);
  return list.filter((item) => !item.read).length;
};

module.exports = {
  registerDevice,
  getDeviceTokensForUsers,
  getAllDeviceTokens,
  addNotificationsForUsers,
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  getAllUserIds,
};
