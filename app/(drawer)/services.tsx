import { useLocalSearchParams } from 'expo-router';
import { AlertTriangle, MapPinned, Phone, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Badge, Body, Button, Muted, Screen, Section, Title } from '../../src/components/ui';
import { matchPharmacies, rankFacilities } from '../../src/lib/facilitySearch';
import { colors, spacing } from '../../src/theme';

export default function ServicesScreen() {
  const params = useLocalSearchParams<{ action?: string }>();
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState('Using Addis Ababa demo coordinates');
  const action = params.action ?? 'hospital';
  const requiredTags = action === 'emergency' ? ['emergency'] : action === 'pharmacy' ? ['pharmacy'] : ['general'];
  const rankedFacilities = useMemo(() => rankFacilities(requiredTags), [action]);
  const pharmacyMatches = useMemo(() => matchPharmacies(['paracetamol', 'oral rehydration salts', 'salbutamol']), []);

  async function pickPrescription() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setUploaded(result.assets[0]?.fileName ?? 'Prescription image selected');
    }
  }

  function requestLocation() {
    setLocationStatus('Location permission flow is ready for Expo native builds; web demo keeps Addis Ababa ranking.');
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <View style={styles.row}>
            <Title>Care options</Title>
            <Badge tone={action === 'emergency' ? 'danger' : action === 'pharmacy' ? 'success' : 'warning'}>{action}</Badge>
          </View>
          <Muted>
            Candidates are seeded for Addis Ababa. Live Google Places, Distance Matrix, and map rendering plug into this flow after API keys are configured.
          </Muted>
          <Button variant="secondary" onPress={requestLocation}>
            Use my location
          </Button>
          <Muted>{locationStatus}</Muted>
        </Section>

        {action === 'emergency' ? (
          <Section>
            <View style={styles.iconRow}>
              <AlertTriangle size={20} stroke={colors.danger} />
              <Body>Emergency confirmation required</Body>
            </View>
            <Muted>Rapha will not place a real ambulance call in the MVP. This confirms a simulated request for demos.</Muted>
            <Button variant="danger" onPress={() => undefined}>
              Simulate ambulance request
            </Button>
          </Section>
        ) : null}

        {action === 'pharmacy' ? (
          <Section>
            <View style={styles.iconRow}>
              <Upload size={20} stroke={colors.primary} />
              <Body>Prescription upload</Body>
            </View>
            <Button variant="secondary" onPress={pickPrescription}>
              Choose prescription image
            </Button>
            {uploaded ? <Muted>{uploaded}</Muted> : null}
          </Section>
        ) : null}

        <Section>
          <View style={styles.iconRow}>
            <MapPinned size={20} stroke={colors.primary} />
            <Body>Ranked facilities</Body>
          </View>
          {rankedFacilities.slice(0, 5).map((facility) => (
            <View key={facility.id} style={styles.item}>
              <Text style={styles.itemTitle}>{facility.name}</Text>
              <Muted>
                {facility.neighborhood} - {facility.etaMinutes} min - {facility.distanceKm} km
              </Muted>
              <View style={styles.tags}>
                {facility.capabilityTags.slice(0, 5).map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </View>
              <View style={styles.iconRow}>
                <Phone size={15} stroke={colors.textMuted} />
                <Muted>{facility.phone}</Muted>
              </View>
            </View>
          ))}
        </Section>

        <Section>
          <Body>Pharmacy stock demo</Body>
          {pharmacyMatches.slice(0, 3).map((pharmacy) => (
            <View key={pharmacy.id} style={styles.item}>
              <Text style={styles.itemTitle}>{pharmacy.name}</Text>
              <Muted>
                {pharmacy.neighborhood} - {pharmacy.availableCount} units matching sample needs
              </Muted>
              {pharmacy.matches.map((stock) => (
                <Muted key={stock.id}>
                  {stock.brandName}: {stock.quantity} {stock.unit}
                </Muted>
              ))}
            </View>
          ))}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  item: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  itemTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
