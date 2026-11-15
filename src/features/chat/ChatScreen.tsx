import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { accentGradient, colors, radii, spacing, typography } from '@/theme/tokens';

import {
  conversationsKey,
  dayLabel,
  formatMoney,
  markSplitPaid,
  type Message,
  messagesKey,
  parseAmount,
  sendMessage,
  sendSplitRequest,
} from './api';
import { useConversations, useMessages } from './hooks';

const CURRENCY = 'GBP';
const GAP_FOR_SEPARATOR_MS = 60 * 60_000;

type Item =
  | { type: 'separator'; key: string; iso: string }
  | { type: 'message'; key: string; message: Message; mine: boolean; lastInRun: boolean };

/** Interleaves day/time separators when an hour or more passes between messages. */
export function withSeparators(messages: Message[], myId: string | null): Item[] {
  const items: Item[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    if (!prev || Date.parse(m.created_at) - Date.parse(prev.created_at) >= GAP_FOR_SEPARATOR_MS) {
      items.push({ type: 'separator', key: `sep-${m.id}`, iso: m.created_at });
    }
    const next = messages[i + 1];
    items.push({
      type: 'message',
      key: m.id,
      message: m,
      mine: m.sender_id === myId,
      lastInRun: !next || next.sender_id !== m.sender_id,
    });
  });
  return items;
}

/** One chat, styled like the reference: grey/orange bubbles and big orange split cards. */
export function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const conversations = useConversations();
  const messages = useMessages(id ?? null);
  const [text, setText] = useState('');
  const [splitOpen, setSplitOpen] = useState(false);
  const listRef = useRef<FlatList<Item>>(null);

  const other = conversations.data?.find((c) => c.conversation_id === id);
  const name = other?.display_name ?? other?.username ?? 'Chat';
  const items = withSeparators(messages.data ?? [], userId);

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: conversationsKey });
  }, [messages.data?.length, queryClient]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: messagesKey(id ?? '') });

  async function send() {
    const body = text.trim();
    if (!body || !id) return;
    setText('');
    try {
      await sendMessage(supabase, id, body);
      await refresh();
    } catch (e) {
      setText(body);
      Alert.alert('Not sent', errorText(e));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerMid}>
          <Avatar name={name} url={other?.avatar_url} size={44} />
          <Text style={styles.headerName}>{name}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.empty}>Say hi to {name} and plan tonight 👋</Text>
          }
          renderItem={({ item }) => {
            if (item.type === 'separator') {
              const { day, time } = dayLabel(item.iso);
              return (
                <Text style={styles.separator}>
                  {day} <Text style={styles.separatorTime}>{time}</Text>
                </Text>
              );
            }
            const m = item.message;
            if (m.kind === 'split') {
              return (
                <SplitCard
                  message={m}
                  mine={item.mine}
                  otherName={name}
                  onPaid={async () => {
                    try {
                      await markSplitPaid(supabase, m.id);
                      await refresh();
                    } catch (e) {
                      Alert.alert('Couldn’t update', errorText(e));
                    }
                  }}
                />
              );
            }
            return (
              <View style={[styles.msgWrap, item.mine ? styles.right : styles.left]}>
                <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.msgText, item.mine && { color: colors.white }]}>
                    {m.body}
                  </Text>
                </View>
                {item.lastInRun && (
                  <View style={[styles.stamp, item.mine && { alignSelf: 'flex-end' }]}>
                    {!item.mine && <Avatar name={name} url={other?.avatar_url} size={18} />}
                    <Text style={styles.stampText}>{dayLabel(m.created_at).time}</Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask to split tickets"
            onPress={() => setSplitOpen(true)}
            style={styles.roundBtn}
            testID="split-open"
          >
            <Ionicons name="cash-outline" size={20} color={colors.text} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            onSubmitEditing={send}
            returnKeyType="send"
            testID="chat-input"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            style={[styles.send, !text.trim() && { opacity: 0.5 }]}
            testID="chat-send"
          >
            <Ionicons name="paper-plane" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SplitSheet
        visible={splitOpen}
        name={name}
        onClose={() => setSplitOpen(false)}
        onSend={async (amount, note) => {
          if (!id) return;
          await sendSplitRequest(supabase, id, amount, CURRENCY, note);
          setSplitOpen(false);
          await refresh();
        }}
      />
    </SafeAreaView>
  );
}

function SplitCard({
  message,
  mine,
  otherName,
  onPaid,
}: {
  message: Message;
  mine: boolean;
  otherName: string;
  onPaid: () => void;
}) {
  const amount = formatMoney(message.amount_minor ?? 0, message.currency ?? CURRENCY);
  return (
    <View style={[styles.splitWrap, mine ? styles.right : styles.left]} testID="split-card">
      <LinearGradient
        colors={accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.split}
      >
        <Text style={styles.splitPill}>{mine ? 'You asked for' : `${otherName} asked for`}</Text>
        <Text style={styles.splitAmount} adjustsFontSizeToFit numberOfLines={1}>
          {amount}
        </Text>
        {!!message.body && <Text style={styles.splitNote}>{message.body}</Text>}
      </LinearGradient>
      {message.paid_at ? (
        <Text style={styles.system}>
          ✓ {mine ? `${otherName} paid you ${amount}` : `You marked ${amount} as paid`}
        </Text>
      ) : mine ? (
        <Text style={styles.system}>Waiting for {otherName}</Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={onPaid} style={styles.paidBtn}>
          <Text style={styles.paidText}>Mark as paid</Text>
        </Pressable>
      )}
    </View>
  );
}

function SplitSheet({
  visible,
  name,
  onClose,
  onSend,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
  onSend: (amountMinor: number, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const minor = parseAmount(amount);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Split tickets with {name}</Text>
        <Text style={styles.sheetSub}>
          Sends a request in the chat. No money moves in Onspot yet — {name} pays you their way and
          marks it as paid.
        </Text>
        <Field
          label="Amount (£)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="15"
          testID="split-amount"
        />
        <Field
          label="What for"
          value={note}
          onChangeText={setNote}
          placeholder="Afro Fridays tickets"
        />
        <Button
          title={minor ? `Ask for ${formatMoney(minor, CURRENCY)}` : 'Ask'}
          disabled={!minor}
          loading={busy}
          testID="split-send"
          onPress={async () => {
            if (!minor) return;
            setBusy(true);
            try {
              await onSend(minor, note.trim());
              setAmount('');
              setNote('');
            } catch (e) {
              Alert.alert('Not sent', errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerMid: { alignItems: 'center', gap: spacing.xs },
  headerName: { ...typography.heading, color: colors.text },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  separator: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  separatorTime: { color: colors.text, fontWeight: '600' },
  msgWrap: { maxWidth: '78%', gap: 4 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  theirs: { backgroundColor: colors.bubbleIn, borderBottomLeftRadius: 6 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  msgText: { ...typography.body, color: colors.text, lineHeight: 21 },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stampText: { fontSize: 11, color: colors.textMuted },
  splitWrap: { width: '78%', gap: spacing.sm, marginVertical: spacing.xs },
  split: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 130,
    justifyContent: 'center',
  },
  splitPill: {
    ...typography.caption,
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  splitAmount: { fontSize: 60, fontWeight: '800', color: 'rgba(255,255,255,0.95)' },
  splitNote: { ...typography.caption, color: colors.white },
  system: {
    ...typography.caption,
    color: colors.textMuted,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  paidBtn: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  paidText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheetTitle: { ...typography.title, color: colors.text },
  sheetSub: { ...typography.caption, color: colors.textMuted },
});
