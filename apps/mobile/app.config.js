// Wraps app.json. With EXPO_GO_ANON=1 (see the `go` script) the EAS projectId is
// dropped so the dev server serves an unsigned anonymous manifest instead of
// blocking on an interactive "Log in to Expo" prompt when Expo Go connects.
module.exports = ({ config }) => {
  if (!process.env.EXPO_GO_ANON) return config;
  const { eas: _eas, ...extra } = config.extra ?? {};
  return { ...config, extra };
};
