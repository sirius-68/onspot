// DRAFT legal copy for the beta. Have a lawyer review it for your launch country before
// public release. Keep these in sync with the store privacy labels (docs/STORE.md).

export type LegalDoc = 'privacy' | 'terms' | 'guidelines';

export const LEGAL: Record<
  LegalDoc,
  { title: string; sections: { heading: string; body: string }[] }
> = {
  privacy: {
    title: 'Privacy',
    sections: [
      {
        heading: 'What we collect',
        body: 'Your email or sign-in provider, username, name, and date of birth (to confirm you are 18+; never shown to anyone). Clips you post, with the time and location they were shot. Your location while the app is open, if you allow it.',
      },
      {
        heading: 'Who sees your location',
        body: 'Only friends you have accepted, only while you use the app, and never in Ghost Mode. Strangers never see where you are. Location history is deleted after 24 hours.',
      },
      {
        heading: 'Clips',
        body: 'Clips are public on the venue page for about an hour. We check each clip was shot at the venue. Report any clip and it is reviewed; clips with several reports are hidden.',
      },
      {
        heading: 'What we never do',
        body: 'We do not sell your personal data or individual location. Venues and partners only see totals, never who you are.',
      },
      {
        heading: 'Your choices',
        body: 'Turn on Ghost Mode, remove friends, block people, or delete your account at any time in Profile. Contact: privacy@onspot.app (replace with your address).',
      },
    ],
  },
  terms: {
    title: 'Terms',
    sections: [
      { heading: 'Age', body: 'You must be 18 or older to use Onspot.' },
      {
        heading: 'Your content',
        body: 'You own your clips and give Onspot permission to show them in the app. Only post clips you shot yourself, at the venue, and respect the people around you.',
      },
      {
        heading: 'Tickets and venues',
        body: 'Tickets may be sold by venues or third parties. Their terms apply to your purchase. Venue information can change; check before you travel.',
      },
      {
        heading: 'Safety',
        body: 'Look after yourself and your friends. Onspot does not guarantee any venue is safe. In an emergency, call your local emergency number.',
      },
    ],
  },
  guidelines: {
    title: 'Community guidelines',
    sections: [
      {
        heading: 'Show the room, not the people',
        body: 'Film the vibe, the crowd energy and the music. Do not focus on individuals who have not agreed to be filmed.',
      },
      {
        heading: 'Real and right now',
        body: 'Only post clips shot in the app at the venue. No staged, old or misleading clips.',
      },
      {
        heading: 'Not allowed',
        body: 'Nudity, violence, harassment, drug dealing, anyone under 18, hate or threats. These are removed and accounts can be banned.',
      },
      {
        heading: 'Respect venue rules',
        body: 'Some venues do not allow phones. Follow the house rules.',
      },
    ],
  },
};
