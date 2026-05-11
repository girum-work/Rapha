import { Pressable, Text, View } from 'react-native';

import type { RichBlock, TriageResponse } from '../../types';
import { colors } from '../../theme';

function toneStyles(tone?: 'neutral' | 'warning' | 'danger' | 'success') {
  if (tone === 'danger') return { bg: '#2A0F14', border: '#7F1D1D', title: '#FCA5A5', body: '#FECACA' };
  if (tone === 'warning') return { bg: '#2A1B0B', border: '#92400E', title: '#FCD34D', body: '#FDE68A' };
  if (tone === 'success') return { bg: '#0B221A', border: '#065F46', title: '#6EE7B7', body: '#A7F3D0' };
  return { bg: colors.surface, border: colors.border, title: colors.textPrimary, body: colors.textSecondary };
}

export function RichContent({
  structured,
  onCtaPress,
}: {
  structured?: TriageResponse;
  onCtaPress?: (cta: Extract<RichBlock, { type: 'cta' }>) => void;
}) {
  if (!structured?.content || structured.content_type !== 'openui') return null;
  const blocks = structured.content.blocks ?? [];
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <View className="mt-3 gap-2">
      {blocks.map((b, idx) => {
        if (b.type === 'callout') {
          const t = toneStyles(b.tone);
          return (
            <View
              key={`${b.type}-${idx}`}
              style={{ backgroundColor: t.bg, borderColor: t.border }}
              className="rounded-2xl border px-4 py-3"
            >
              <Text style={{ color: t.title }} className="text-[13px] font-semibold">
                {b.title}
              </Text>
              {b.body ? (
                <Text style={{ color: t.body }} className="mt-1 text-[13px] leading-5">
                  {b.body}
                </Text>
              ) : null}
            </View>
          );
        }

        if (b.type === 'bullets') {
          return (
            <View key={`${b.type}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              {b.title ? (
                <Text className="text-[13px] font-semibold text-white">{b.title}</Text>
              ) : null}
              <View className={b.title ? 'mt-2 gap-1' : 'gap-1'}>
                {b.items.map((item, i) => (
                  <View key={`${idx}-${i}`} className="flex-row gap-2">
                    <Text className="text-[13px] leading-5 text-white/70">{'\u2022'}</Text>
                    <Text className="flex-1 text-[13px] leading-5 text-white/80">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        if (b.type === 'cta') {
          return (
            <Pressable
              key={`${b.type}-${idx}`}
              onPress={() => onCtaPress?.(b)}
              className="rounded-2xl bg-teal-500 px-4 py-3"
            >
              <Text className="text-center text-[13px] font-semibold text-[#071016]">{b.label}</Text>
            </Pressable>
          );
        }

        return null;
      })}
    </View>
  );
}

