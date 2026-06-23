import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, R, S } from '../utils/theme';

interface Option { label: string; value: string }
interface DropdownProps {
  options: Option[];
  value: string | null;
  onSelect: (value: string | null) => void;
  placeholder?: string;
  allowNull?: boolean;
  nullLabel?: string;
}

export default function Dropdown({
  options,
  value,
  onSelect,
  placeholder = 'Seleccionar',
  allowNull = false,
  nullLabel = 'Sin especificar',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ? options.find(o => o.value === value)?.label : null;

  const handleSelect = (val: string | null) => { onSelect(val); setOpen(false); };

  const listData = allowNull
    ? [{ label: nullLabel, value: '__null__' }, ...options]
    : options;

  return (
    <>
      <Pressable
        style={({ pressed }) => [s.trigger, pressed && { backgroundColor: C.surfaceHigh }]}
        onPress={() => setOpen(true)}
      >
        <Text style={[s.triggerText, !selectedLabel && s.placeholder]} numberOfLines={1}>
          {selectedLabel ?? (allowNull ? nullLabel : placeholder)}
        </Text>
        <Ionicons name="chevron-down-outline" size={16} color={C.textDim} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <FlatList
              data={listData}
              keyExtractor={item => item.value}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              renderItem={({ item }) => {
                const isNull = item.value === '__null__';
                const isSelected = isNull ? value === null : value === item.value;
                return (
                  <Pressable
                    style={({ pressed }) => [s.option, isSelected && s.optionActive, pressed && s.optionPressed]}
                    onPress={() => handleSelect(isNull ? null : item.value)}
                  >
                    <Text style={[s.optionText, isSelected && s.optionTextActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-outline" size={16} color={C.accent} />}
                  </Pressable>
                );
              }}
              contentContainerStyle={s.listContent}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: C.border, borderRadius: R.sm,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: C.surfaceUp,
  },
  triggerText: { fontSize: F.base, color: C.text, flex: 1, marginRight: S.xs },
  placeholder: { color: C.textDim },

  overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingTop: 12, maxHeight: '62%',
    borderTopWidth: 1, borderColor: C.border,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 10 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.borderFaint, marginHorizontal: 4 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 4, borderRadius: R.xs,
  },
  optionActive: { },
  optionPressed: { backgroundColor: C.surfaceHigh },
  optionText: { fontSize: F.base, color: C.textSec, flex: 1, marginRight: S.xs },
  optionTextActive: { color: C.accent, fontWeight: '700' },
});
