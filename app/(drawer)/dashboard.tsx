import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Hospital, Pill } from 'lucide-react-native';

import { Badge, Body, Muted, Screen, Section, Title } from '../../src/components/ui';
import { facilities, pharmacyStock } from '../../src/data/facilities';
import { colors, spacing } from '../../src/theme';

export default function DashboardScreen() {
  const emergencyReady = facilities.filter((facility) => facility.capabilityTags.includes('emergency')).length;
  const stockedItems = pharmacyStock.reduce((total, stock) => total + stock.quantity, 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <Title>Dashboard</Title>
          <Muted>Addis Ababa demo workspace with session continuity, facility capability tags, and pharmacy stock ready.</Muted>
        </Section>

        <Section>
          <View style={styles.line}>
            <Hospital size={20} stroke={colors.primary} />
            <View style={styles.flex}>
              <Body>Emergency-capable facilities</Body>
              <Muted>{emergencyReady} seeded hospitals support emergency routing.</Muted>
            </View>
            <Badge tone="success">{emergencyReady}</Badge>
          </View>
          <View style={styles.line}>
            <Pill size={20} stroke={colors.primary} />
            <View style={styles.flex}>
              <Body>Tracked stock units</Body>
              <Muted>Realtime Supabase updates connect to this catalog.</Muted>
            </View>
            <Badge>{stockedItems}</Badge>
          </View>
          <View style={styles.line}>
            <CalendarClock size={20} stroke={colors.warning} />
            <View style={styles.flex}>
              <Body>Deferred care reminders</Body>
              <Muted>Six-hour reminder records are tied to deferred sessions.</Muted>
            </View>
            <Badge tone="warning">ready</Badge>
          </View>
        </Section>

        <Section>
          <Body>Next integrations</Body>
          <Text style={styles.task}>Supabase project URL and anon key</Text>
          <Text style={styles.task}>Claude API key in Edge Functions</Text>
          <Text style={styles.task}>Google Maps and Vision API keys</Text>
          <Text style={styles.task}>Twilio SMS or WhatsApp fallback after demo flow</Text>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  task: {
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.xs,
  },
});
