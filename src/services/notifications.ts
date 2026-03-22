import * as Notifications from 'expo-notifications';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const scheduleReminders = async (settings: {
  lunch: boolean;
  dinner: boolean;
}): Promise<void> => {
  // Cancel all existing scheduled notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (settings.lunch) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lunch time! 🍽️',
        body: "Don't forget to log your lunch",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 12,
        minute: 30,
      },
    });
  }

  if (settings.dinner) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dinner time! 🌙',
        body: "Don't forget to log your dinner",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 19,
        minute: 0,
      },
    });
  }
};

export const cancelAllReminders = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
