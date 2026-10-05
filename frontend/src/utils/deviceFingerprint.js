let fpPromise;

export async function getDeviceFingerprint() {
  const [{ default: FingerprintJS }, { load: loadBotD }] = await Promise.all([
    import('@fingerprintjs/fingerprintjs'), import('@fingerprintjs/botd')
  ]);
  fpPromise ||= FingerprintJS.load();
  const fpAgent = await fpPromise;
  const fpResult = await fpAgent.get();

  let botScore = 0;
  let botFlags = [];
  let isBot = false;

  try {
    const botAgent = await loadBotD();
    await botAgent.collect();
    const botResult = botAgent.detect();

    isBot = Boolean(botResult?.bot);
    if (isBot) {
      botScore = 1;
      botFlags = botResult.botKind ? [botResult.botKind] : ['bot'];
    }
  } catch (err) {
    console.warn('Device fingerprint bot check failed:', err);
  }

  return {
    deviceId: fpResult.visitorId,
    botScore,
    botFlags,
    isBot
  };
}
