import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type AdsSdk = typeof import("react-native-google-mobile-ads");
const BANNER_IDS = {
  ios: "ca-app-pub-9535995743311423/4708929328",
  android: "ca-app-pub-9535995743311423/8612962427",
};
const REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };
let initialization: Promise<unknown> | undefined;

async function initialize(sdk: AdsSdk) {
  if (!initialization) {
    initialization = (async () => {
      await sdk.default().setRequestConfiguration({
        maxAdContentRating: sdk.MaxAdContentRating.G,
        publisherPrivacyPersonalizationState: "disabled",
      });
      await sdk.default().setPublisherFirstPartyIdEnabled(false);
      await sdk.default().initialize();
    })().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

// Mounted only after server confirmation of a free-plan ADMIN. No family or ledger data goes to ads.
export function FreePlanBanner() {
  const [sdk, setSdk] = useState<AdsSdk | null>(null);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let cancelled = false;
    void (async () => {
      // Lazy loading lets Expo Go and web run without the native ads module.
      const ads = await import("react-native-google-mobile-ads");
      if (cancelled) return;
      const info = await ads.AdsConsent.gatherConsent();
      if (cancelled) return;
      setSdk(ads);
      setPrivacyRequired(info.privacyOptionsRequirementStatus === ads.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      if (!info.canRequestAds) return;
      await initialize(ads);
      if (!cancelled) setReady(true);
    })().catch(() => {
      // Consent, network, or native-module failures must never block the ledger.
    });
    return () => { cancelled = true; };
  }, []);

  async function openPrivacyOptions() {
    if (!sdk || privacyBusy) return;
    setPrivacyBusy(true);
    setReady(false); // Remove the current ad before consent can change.
    try {
      const info = await sdk.AdsConsent.showPrivacyOptionsForm();
      setPrivacyRequired(info.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED);
      if (info.canRequestAds) {
        await initialize(sdk);
        setFailed(false);
        setRevision((value) => value + 1);
        setReady(true);
      }
    } catch {
      Alert.alert("Ad privacy", "Unable to open ad privacy choices. Please try again.");
    } finally {
      setPrivacyBusy(false);
    }
  }

  if (!sdk || ((!ready || failed) && !privacyRequired)) return null;
  const testAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_TEST_ADS !== "false";
  const unitId = testAds ? sdk.TestIds.BANNER : Platform.OS === "ios" ? BANNER_IDS.ios : BANNER_IDS.android;
  const BannerAd = sdk.BannerAd;

  return (
    <View style={styles.container}>
      {ready && !failed && (
        <>
          <Text style={styles.label}>Advertisement</Text>
          <BannerAd key={revision} unitId={unitId} size={sdk.BannerAdSize.BANNER}
            requestOptions={REQUEST_OPTIONS} onAdFailedToLoad={() => setFailed(true)} />
        </>
      )}
      {privacyRequired && (
        <Pressable onPress={openPrivacyOptions} disabled={privacyBusy} accessibilityRole="button" style={styles.privacy}>
          <Text style={styles.privacyText}>{privacyBusy ? "Opening privacy choices…" : "Ad privacy choices"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 12, gap: 6, borderTopWidth: 1, borderTopColor: "#dce3da", backgroundColor: "#f6f7f3" },
  label: { fontSize: 10, color: "#667568" },
  privacy: { padding: 10 },
  privacyText: { fontSize: 12, color: "#215c43", textDecorationLine: "underline" },
});
