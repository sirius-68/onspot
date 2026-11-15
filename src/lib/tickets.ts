import { Alert, Linking } from 'react-native';

import { track } from './analytics';

/** Opens the host's ticket page. Demo events have no real page, so explain instead. */
export function openTicketLink(url: string, venueId: string) {
  track('ticket_link_opened', { venue_id: venueId });
  if (url.startsWith('demo:')) {
    Alert.alert(
      'Tickets',
      'In the live app this opens the host’s ticket page. Demo events don’t sell real tickets.',
    );
    return;
  }
  void Linking.openURL(url);
}
