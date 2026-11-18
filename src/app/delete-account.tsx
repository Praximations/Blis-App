// Asking for the account to be deleted. Shopify keeps customer accounts and
// only the shop can erase one, so the app sends the request to the shop.

import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TopBar } from '@/components/TopBar';
import { config } from '@/config';
import { openWeb } from '@/lib/links';
import { useAuth } from '@/state/auth';
import { colors, gutter, maxWidth } from '@/theme/tokens';

export default function DeleteAccountScreen() {
  const auth = useAuth();
  const email = auth.customer?.emailAddress?.emailAddress ?? '';

  const request = () => {
    const subject = 'Please delete my Blis Farms account';
    const body = `Please delete my Blis Farms account and the personal details you hold about me.\n\nAccount email: ${email}\n`;
    void openWeb(`mailto:${config.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Delete my account" right={null} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <Text variant="title" accessibilityRole="header">
            Delete my account
          </Text>
          <Text>
            Send us the request below and we will delete your Blis Farms account and the personal details we hold
            about you. This can&apos;t be undone: your order history and saved details will no longer be available to
            you.
          </Text>
          {email ? (
            <Text variant="lede">
              Account: {email}
            </Text>
          ) : null}
          <Button label="Email my request" icon="mail" wide onPress={request} testID="delete-account-request" />
          <Text variant="hint">
            This opens an email to {config.supportEmail}. You can also call us on {config.supportPhone}.
          </Text>
          <Button label="Keep my account" variant="outline" wide onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingTop: 24, paddingBottom: 40 },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 16 },
});
