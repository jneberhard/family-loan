import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://familyloanledger.com").replace(/\/$/, "");
const TOKEN_KEY = "kinledger.session";
const PASSWORD_CHANGE_KEY = "kinledger.mustChangePassword";
const GREEN = "#215c43";

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

type Entry = {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  rate: number | null;
  balance: number;
};

type HomeData = {
  viewer: { name: string; role: "ADMIN" | "CHILD" };
  family: { name: string; interestPostingDay: number };
  accounts: { id: string; name: string; annualRate: number; balance: number; entries: Entry[] }[];
};
type NewEntryType = "LOAN" | "PAYMENT" | "ADJUSTMENT";

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-KinLedger-Client": "native",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [data, setData] = useState<HomeData | null>(null);
  const [entryAccount, setEntryAccount] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<NewEntryType>("LOAN");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryDate, setEntryDate] = useState(todayDate());
  const [showDeletion, setShowDeletion] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [hasPendingDeletionRequest, setHasPendingDeletionRequest] = useState(false);
  const [deletionComplete, setDeletionComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadHome = useCallback(async (activeToken: string) => {
    const result = await api<HomeData>("/api/mobile/home", {}, activeToken);
    setData(result);
  }, []);

  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(PASSWORD_CHANGE_KEY),
    ])
      .then(([savedToken, savedPasswordChange]) => {
        if (!savedToken) return;
        setToken(savedToken);
        if (savedPasswordChange === "true") {
          setMustChangePassword(true);
          return;
        }
        return loadHome(savedToken).catch(async () => {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(PASSWORD_CHANGE_KEY);
          setToken(null);
        });
      })
      .catch(() => setToken(null));
  }, [loadHome]);

  useEffect(() => {
    if (!showDeletion || !token) return;
    api<{ requests: { id: string; status: string }[] }>("/api/account/deletion-request", {}, token)
      .then(({ requests }) => setHasPendingDeletionRequest(requests.some((item) => item.status === "PENDING")))
      .catch(() => setHasPendingDeletionRequest(false));
  }, [showDeletion, token]);

  async function signIn() {
    setBusy(true);
    try {
      const result = await api<{ token: string; role: string; mustChangePassword: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.role === "SUPER_USER") {
        Alert.alert("Use the web console", "Super-user accounts are managed on the Family Loan Ledger website.");
        setBusy(false);
        return;
      }
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      await SecureStore.setItemAsync(PASSWORD_CHANGE_KEY, String(result.mustChangePassword));
      setToken(result.token);
      setMustChangePassword(result.mustChangePassword);
      setPassword("");
      if (!result.mustChangePassword) await loadHome(result.token);
    } catch (error) {
      Alert.alert("Unable to sign in", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword() {
    setBusy(true);
    try {
      const result = await api<{ token?: string }>(
        "/api/auth/change-password",
        { method: "POST", body: JSON.stringify({ currentPassword: password, newPassword }) },
        token ?? undefined,
      );
      if (result.token) {
        await SecureStore.setItemAsync(TOKEN_KEY, result.token);
        await SecureStore.deleteItemAsync(PASSWORD_CHANGE_KEY);
        setToken(result.token);
        await loadHome(result.token);
      }
      setMustChangePassword(false);
      setPassword("");
      setNewPassword("");
    } catch (error) {
      Alert.alert("Unable to change password", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      await loadHome(token);
    } catch (error) {
      Alert.alert("Unable to refresh", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveEntry(accountId: string) {
    const amount = Number(entryAmount);
    const invalidAmount = !Number.isFinite(amount) || amount === 0 || (entryType !== "ADJUSTMENT" && amount < 0);
    const parsedDate = new Date(`${entryDate}T12:00:00Z`);
    const invalidDate = !/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== entryDate;
    if (invalidAmount || invalidDate || !entryDescription.trim()) {
      Alert.alert("Check the entry", "Enter a valid date, description, and non-zero amount. Adjustments may be negative.");
      return;
    }
    setBusy(true);
    try {
      await api(
        "/api/transactions",
        {
          method: "POST",
          body: JSON.stringify({
            accountId,
            type: entryType,
            amount,
            description: entryDescription.trim(),
            effectiveAt: entryDate,
          }),
        },
        token ?? undefined,
      );
      setEntryAccount(null);
      setEntryAmount("");
      setEntryDescription("");
      await loadHome(token!);
    } catch (error) {
      Alert.alert("Unable to save entry", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      if (token) await api("/api/auth/logout", { method: "POST" }, token);
    } catch {
      // Clear local credentials even if the server cannot be reached; the token still expires within 24 hours.
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(PASSWORD_CHANGE_KEY);
      setToken(null);
      setData(null);
      setMustChangePassword(false);
      setPassword("");
      setNewPassword("");
    }
  }

  async function requestDeletion() {
    if (!token || !deletionPassword || deletionConfirmation !== "DELETE") {
      Alert.alert("Confirm account deletion", "Enter your password and type DELETE to confirm.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ status: "PENDING" | "COMPLETED"; message: string }>(
        "/api/account/deletion-request",
        { method: "POST", body: JSON.stringify({ password: deletionPassword, confirmation: deletionConfirmation }) },
        token,
      );
      setDeletionPassword("");
      setDeletionConfirmation("");
      if (result.status === "COMPLETED") {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(PASSWORD_CHANGE_KEY);
        setToken(null);
        setData(null);
        setDeletionComplete(true);
      } else {
        setDeletionMessage(result.message);
        setHasPendingDeletionRequest(true);
      }
    } catch (error) {
      Alert.alert("Unable to delete account", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletionRequest() {
    if (!token) return;
    setBusy(true);
    try {
      await api("/api/account/deletion-request", { method: "DELETE" }, token);
      setHasPendingDeletionRequest(false);
      setDeletionMessage("Your pending deletion request was cancelled.");
    } catch (error) {
      Alert.alert("Unable to cancel request", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {deletionComplete ? (
          <View style={styles.deletionContent}>
            <View style={styles.brandMark}><Text style={styles.markText}>F</Text></View>
            <Text style={styles.brand}>Family Loan Ledger</Text>
            <Text style={styles.authTitle}>Account deleted</Text>
            <Text style={styles.intro}>Your sign-in and identifying account details were removed. Your family’s shared loan ledger remains with identifying details removed.</Text>
          </View>
        ) : token && data && showDeletion && !mustChangePassword ? (
          <ScrollView contentContainerStyle={styles.deletionContent} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => { setShowDeletion(false); setDeletionMessage(""); }} accessibilityRole="button">
              <Text style={styles.link}>← Back to family ledger</Text>
            </Pressable>
            <Text style={styles.brand}>Family Loan Ledger</Text>
            <Text style={styles.authTitle}>Account &amp; privacy</Text>
            <Text style={styles.intro}>Deleting your account removes your sign-in and identifying details. Shared loan entries stay with your family, with your identity anonymized.</Text>
            {data.viewer.role === "ADMIN" && (
              <View style={styles.deletionNotice}>
                <Text style={styles.entryTitle}>Family administrator access</Text>
                <Text style={styles.body}>If you are the only family administrator, deletion will wait until family access can be transferred. Add a co-parent before submitting to complete deletion right away.</Text>
              </View>
            )}
            {deletionMessage ? <View style={styles.deletionNotice}><Text style={styles.body}>{deletionMessage}</Text></View> : null}
            {hasPendingDeletionRequest && (
              <Pressable style={styles.cancelButton} onPress={cancelDeletionRequest} disabled={busy}>
                <Text style={styles.cancelButtonText}>{busy ? "Please wait…" : "Cancel pending request"}</Text>
              </Pressable>
            )}
            <Text style={styles.sectionTitle}>Confirm with your current password</Text>
            <TextInput style={styles.input} value={deletionPassword} onChangeText={setDeletionPassword} placeholder="Current password" secureTextEntry autoCapitalize="none" />
            <Text style={styles.body}>For immediate deletion, type DELETE below. This cannot be undone.</Text>
            <TextInput style={styles.input} value={deletionConfirmation} onChangeText={setDeletionConfirmation} placeholder="Type DELETE" autoCapitalize="characters" />
            <Pressable style={styles.dangerButton} onPress={requestDeletion} disabled={busy || !deletionPassword || deletionConfirmation !== "DELETE" || hasPendingDeletionRequest}>
              {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{hasPendingDeletionRequest ? "Deletion request pending" : "Delete my account"}</Text>}
            </Pressable>
            <Pressable onPress={() => API_URL && Linking.openURL(`${API_URL}/privacy`)} style={styles.centerLink} accessibilityRole="link">
              <Text style={styles.link}>Read the privacy notice</Text>
            </Pressable>
          </ScrollView>
        ) : token && data && !mustChangePassword ? (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={GREEN} />}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.brand}>Family Loan Ledger</Text>
                <Text style={styles.subtitle}>{data.family.name}</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable onPress={() => setShowDeletion(true)} accessibilityRole="button">
                  <Text style={styles.link}>Account &amp; privacy</Text>
                </Pressable>
                <Pressable onPress={signOut} accessibilityRole="button">
                  <Text style={styles.secondaryLink}>Sign out</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.greeting}>Hello, {data.viewer.name}</Text>
            <Text style={styles.intro}>
              {data.viewer.role === "ADMIN" ? "Your family loan accounts" : "Your loan account"}
            </Text>

            {data.accounts.length === 0 ? (
              <View style={styles.emptyCard}><Text style={styles.body}>No loan accounts to show yet.</Text></View>
            ) : data.accounts.map((account) => (
              <View key={account.id} style={styles.accountCard}>
                <View style={styles.accountTop}>
                  <View style={styles.flex}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.rate}>{account.annualRate.toFixed(2)}% annual rate</Text>
                  </View>
                  <Text style={styles.balance}>{money(account.balance)}</Text>
                </View>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {account.entries.length === 0 ? <Text style={styles.body}>No transactions yet.</Text> :
                  account.entries.slice(0, 8).map((entry) => (
                    <View key={entry.id} style={styles.entryRow}>
                      <View style={styles.flex}>
                        <Text style={styles.entryTitle}>{entry.description || entry.type}</Text>
                        <Text style={styles.entryMeta}>{entry.type} · {dateLabel(entry.date)}</Text>
                      </View>
                      <Text style={styles.entryAmount}>{money(entry.amount)}</Text>
                    </View>
                  ))}
                {data.viewer.role === "ADMIN" && (
                  <>
                    <Pressable
                      style={styles.addButton}
                      onPress={() => setEntryAccount(entryAccount === account.id ? null : account.id)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.addButtonText}>{entryAccount === account.id ? "Close entry form" : "+ Add loan or payment"}</Text>
                    </Pressable>
                    {entryAccount === account.id && (
                      <View style={styles.entryForm}>
                        <Text style={styles.sectionTitle}>New ledger entry</Text>
                        <View style={styles.typeRow}>
                          {(["LOAN", "PAYMENT", "ADJUSTMENT"] as const).map((type) => (
                            <Pressable
                              key={type}
                              onPress={() => setEntryType(type)}
                              style={[styles.typeButton, entryType === type && styles.typeButtonSelected]}
                            >
                              <Text style={[styles.typeText, entryType === type && styles.typeTextSelected]}>
                                {type === "LOAN" ? "Loan" : type === "PAYMENT" ? "Payment" : "Adjustment"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <TextInput style={styles.input} value={entryAmount} onChangeText={setEntryAmount} placeholder={entryType === "ADJUSTMENT" ? "Amount (negative allowed)" : "Amount in dollars"} keyboardType="decimal-pad" />
                        <TextInput style={styles.input} value={entryDescription} onChangeText={setEntryDescription} placeholder="Description" />
                        <TextInput style={styles.input} value={entryDate} onChangeText={setEntryDate} placeholder="Effective date (YYYY-MM-DD)" autoCapitalize="none" />
                        <Pressable style={styles.button} onPress={() => saveEntry(account.id)} disabled={busy}>
                          {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Save entry</Text>}
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
            <Text style={styles.footer}>Pull down to refresh your ledger.</Text>
          </ScrollView>
        ) : mustChangePassword ? (
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.brand}>Family Loan Ledger</Text>
            <Text style={styles.authTitle}>Choose a new password</Text>
            <Text style={styles.intro}>Your temporary password must be replaced before you continue.</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Temporary password" secureTextEntry autoCapitalize="none" />
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password (12+ characters)" secureTextEntry autoCapitalize="none" />
            <Pressable style={styles.button} onPress={updatePassword} disabled={busy}>
              {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Save new password</Text>}
            </Pressable>
            <Pressable onPress={signOut} style={styles.centerLink}><Text style={styles.link}>Sign out</Text></Pressable>
          </ScrollView>
        ) : token && !data ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={GREEN} /><Text style={styles.body}>Loading your family…</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <View style={styles.brandMark}><Text style={styles.markText}>F</Text></View>
            <Text style={styles.brand}>Family Loan Ledger</Text>
            <Text style={styles.authTitle}>Family loans, clearly managed.</Text>
            <Text style={styles.intro}>Sign in to see your family loan ledger.</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" autoComplete="password" onSubmitEditing={signIn} />
            <Pressable style={styles.button} onPress={signIn} disabled={busy || !email || !password}>
              {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Pressable>
            <Text style={styles.footer}>Private access for your family.</Text>
            <Pressable
              onPress={() => API_URL && Linking.openURL(`${API_URL}/privacy`)}
              style={styles.centerLink}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Privacy notice</Text>
            </Pressable>
            <Pressable
              onPress={() => API_URL && Linking.openURL(`${API_URL}/delete-account`)}
              style={styles.centerLink}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Request account deletion</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7f3" },
  flex: { flex: 1 },
  content: { padding: 22, paddingTop: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 38 },
  headerActions: { alignItems: "flex-end", gap: 8 },
  brand: { color: GREEN, fontSize: 23, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: "#65736b", fontSize: 13, marginTop: 3 },
  greeting: { color: "#1c2b22", fontSize: 28, fontWeight: "700", letterSpacing: -0.7 },
  intro: { color: "#66746b", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 22 },
  accountCard: { backgroundColor: "#fff", borderRadius: 20, padding: 19, marginBottom: 15, borderWidth: 1, borderColor: "#e7ebe5" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: "#e7ebe5" },
  accountTop: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: "#edf0eb" },
  accountName: { color: "#1e3025", fontSize: 18, fontWeight: "700" },
  rate: { color: "#718077", fontSize: 12, marginTop: 5 },
  balance: { color: GREEN, fontSize: 21, fontWeight: "800", marginLeft: 8 },
  sectionTitle: { color: "#526258", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 17, marginBottom: 5 },
  entryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f2ee" },
  entryTitle: { color: "#29382e", fontSize: 14, fontWeight: "600" },
  entryMeta: { color: "#78847d", fontSize: 12, marginTop: 4 },
  entryAmount: { color: "#29382e", fontSize: 14, fontWeight: "700", marginLeft: 8 },
  addButton: { alignSelf: "flex-start", backgroundColor: "#eaf2ec", paddingVertical: 11, paddingHorizontal: 13, borderRadius: 11, marginTop: 13 },
  addButtonText: { color: GREEN, fontWeight: "700", fontSize: 13 },
  entryForm: { borderTopWidth: 1, borderTopColor: "#edf0eb", marginTop: 15, paddingTop: 4 },
  typeRow: { flexDirection: "row", gap: 7, marginBottom: 11 },
  typeButton: { borderWidth: 1, borderColor: "#dfe5dd", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  typeButtonSelected: { borderColor: GREEN, backgroundColor: "#eaf2ec" },
  typeText: { color: "#59675e", fontSize: 12, fontWeight: "600" },
  typeTextSelected: { color: GREEN },
  body: { color: "#718077", fontSize: 14, lineHeight: 21 },
  footer: { color: "#859087", fontSize: 12, textAlign: "center", marginTop: 20 },
  link: { color: GREEN, fontSize: 14, fontWeight: "700" },
  secondaryLink: { color: "#76837a", fontSize: 12, fontWeight: "600" },
  authContent: { flexGrow: 1, justifyContent: "center", padding: 26, paddingBottom: 40 },
  brandMark: { alignSelf: "center", backgroundColor: GREEN, width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  markText: { color: "#fff", fontSize: 29, fontWeight: "800" },
  authTitle: { color: "#1c2b22", fontSize: 27, lineHeight: 34, fontWeight: "700", marginTop: 34 },
  input: { backgroundColor: "#fff", borderColor: "#dfe5dd", borderWidth: 1, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 15, fontSize: 15, color: "#1c2b22", marginBottom: 12 },
  button: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: GREEN, borderRadius: 14, marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  centerLink: { alignSelf: "center", padding: 16 },
  deletionContent: { flexGrow: 1, justifyContent: "center", padding: 26, paddingBottom: 40 },
  deletionNotice: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7ebe5", borderRadius: 14, padding: 15, marginBottom: 16, gap: 5 },
  dangerButton: { minHeight: 52, alignItems: "center", justifyContent: "center", backgroundColor: "#a33f36", borderRadius: 14, marginTop: 4 },
  cancelButton: { alignSelf: "flex-start", paddingVertical: 10, marginBottom: 10 },
  cancelButtonText: { color: "#526258", fontSize: 13, fontWeight: "700" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
});
