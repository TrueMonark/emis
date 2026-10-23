import { View } from "react-native";
import { useLocal } from "./events";
import { useSession } from "./session";
import { lastSyncAt, mustGoOnline, offlineDays, pendingCount, useSyncState } from "./sync";
import { dateTimeLabel } from "./dates";
import { Banner, Muted } from "./ui";

/** Sync status at the top of the home page: offline, waiting changes, problems. */
export function SyncStatus() {
  const { online } = useSession();
  const st = useSyncState();
  const info = useLocal(() => ({ last: lastSyncAt(), waiting: pendingCount(), mustSync: mustGoOnline(), days: offlineDays() }));
  return (
    <View style={{ gap: 8 }}>
      {st.blocked && <Banner tone="red" icon="lock-closed" text={`The server refused this account: ${st.blocked}`} />}
      {info.mustSync && (
        <Banner tone="red" icon="cloud-offline" text={`Not synced for more than ${info.days} days. Connect to the internet and sync once to keep saving.`} />
      )}
      {!online && <Banner icon="cloud-offline" text="No connection. Everything you save is kept on the phone and sent when signal returns." />}
      {st.lastError && online && !st.blocked && <Banner tone="amber" icon="warning" text={`Last sync didn't finish: ${st.lastError}`} />}
      <Muted>
        {st.syncing ? "Syncing…" : `Last synced ${dateTimeLabel(info.last)}`}
        {info.waiting ? ` · ${info.waiting} waiting to send` : " · everything sent"}
      </Muted>
    </View>
  );
}
