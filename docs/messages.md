# BingO Messages (1.0.0)

A chat for classes, inside BingO: a **„Съобщения“** tab for students and a section in the teacher's part.
It looks and feels like Apple's Messages (blue bubbles, grouped by sender, "Видяно", "… пише") with
Instagram's touches (double-tap for ❤️, a reaction bar on hold, reply, unsend).

## What people can do

| | |
|---|---|
| **Group chat per class** | Made automatically for every class; whoever is in the class is in the chat (joining, leaving, being removed, a co-teacher — the chat follows). |
| **Private chats** | A student can write privately to the teachers of their classes; a teacher to anyone in their classes. Students cannot start private chats with each other. |
| **Messages** | Text (up to 4000 characters), clickable links, big emoji when a message is only 1–3 emoji, replies with a quote, unsend (the sender), remove (a teacher, in their chats). |
| **Reactions** | ❤️ 😂 😮 😢 😡 👍 — one per person per message. Double-tap = ❤️. Tap the badge to see who reacted. |
| **Files** | Any file type up to **25 MB**, up to 10 in a message; pick, paste or drag & drop. Pictures show inline (a grid for several, a smaller copy for big photos), videos and audio play in the chat, everything else is a card with *Изтегли*. |
| **Read and typing** | "Изпратено" / "Видяно" / "Видяно от N" under your last message, "… пише" while someone types, an unread dot in the list and a count on the tab, a toast when a message arrives in another chat (never during a test or practice). |
| **Notifications** | While BingO is open in the background: a system notification for each new message (tap → the chat), in front: a toast. When BingO is closed: **web push** (below). The unread count is in the tab bar and the page title ("(2) BingO"). The bell in the header turns them on or off for this device; *Заглуши разговора* (tap the chat's name) mutes one chat. Never during a test, a quiz or practice — on the device, and the server sends no push to a student with a test running. |
| **Demo mode** | *Демо ученик* and *Демо учител* have chats too: the class chats of 12А and 12Б and a private chat between the teacher and Мария, all on the device. Pictures sent in the demo stay on the device; Google Drive, Docs and Meet need a real Google account. |
| **Laptop and phone** | On a wide screen the list and the chat sit side by side; on a phone the chat opens on top. Enter sends on a computer (Shift+Enter for a new line). Dark mode and English work like the rest of BingO. |

## Google Workspace

- **Google links become cards**: Docs, Sheets, Slides, Forms, Drawings, Drive files and folders, Meet, Calendar, Classroom, Sites, Maps, YouTube. Docs/Sheets/Slides/Drawings/Drive/Forms cards have **Преглед** (an embedded preview, on the web) and **Отвори** (on Android the link opens in the Google app). When the sender's device already has Google Drive access, a pasted link gets the file's real name.
- **From Google Drive** (+ → *От Google Drive*): recent files and search in your Drive, pick several, and choose who can open them: *as shared now*, *give the other person / everyone in the class view access* (a teacher in a class chat, or anyone in a private chat), or *anyone with the link*. BingO adds the Drive permissions with your own Google account, without notification emails.
- **Word, Excel, PowerPoint (and OpenDocument, CSV, text) open in Google**: *Отвори в Google Документи / Таблици / Презентации* makes a converted copy in **your** Drive and opens it. *Преглед* shows the file in Google's viewer without copying it.
- **Google Drive shortcut files** (`.gdoc`, `.gsheet`, `.gslides`, `.gform`, `.gdraw` … from Drive for desktop) are not uploaded as useless 1 KB files: BingO reads the link inside and sends the real document.
- **Save to Google Drive**: hold a message with files → *Запази в Google Drive*.
- **Google Meet**: the camera button in the chat's header creates a Meet call (an event in your Google Calendar) and posts the link.

All of this runs with the person's own Google account in the app (the same way as the Classroom/Forms/Drive/Calendar features in 0.7.0); nothing passes through BingO's servers.

## Setup (once)

Everything from [`firebase.md`](firebase.md) applies. Then:

1. **Deploy the rules and the functions** (new: `chatSyncClass`, `chatEnsure`, `chatOpenDm`, `chatEmails`, `chatNotify` in `functions/chat.js`):
   ```bash
   firebase deploy --only firestore:rules,storage,functions
   ```
   `chatSyncClass` is a Firestore trigger (Eventarc): the first deploy may ask to enable the Eventarc API and to grant the Pub/Sub service account the *Service Account Token Creator* role; the CLI tells you how.
2. **Classes that already exist** get their group chat the first time someone in them opens *Съобщения* (`chatEnsure`), or on their next change.
3. **Storage CORS**, for *Отвори в Google Документи* and *Запази в Google Drive* (the browser must fetch the file from Storage to hand it to Drive):
   ```bash
   gsutil cors set storage.cors.json gs://<your-project>.appspot.com
   ```
   Without it, those two buttons say the file could not be fetched; download and preview still work.
4. **Google APIs** in the same Google Cloud project: Drive API and Calendar API (already needed for 0.7.0). Sharing Drive files with the chat uses the full `drive` scope (only asked for when someone picks a sharing option). Until Google verifies the app, add teachers (and students who share files) as test users of the OAuth consent screen, or use the school's own Workspace (internal app).

## Push notifications (BingO closed)

1. Firebase console → Project settings → **Cloud Messaging** → *Web Push certificates* → generate a key pair, and add the public key to the Firebase config as `vapidKey`:
   `BINGO_FIREBASE = {"apiKey": "…", "projectId": "…", "messagingSenderId": "…", "appId": "…", …, "vapidKey": "B…"}` (the GitHub variable or `tools/config.json`). `messagingSenderId` and `appId` must be in it too.
2. `python3 tools/build.py web` now writes **`dist/web/bingo-push-sw.js`** next to the page; the Build workflow uploads both. The worker must be served from the same folder as the page (e.g. `https://preotkrivanegk.com/bingo/bingo-push-sw.js`).
3. Deploy the functions: **`chatNotify`** (a trigger on new messages) sends the push to the other members' devices (`users/{uid}/push`), skips muted chats and students with a test running, and deletes dead tokens. The link opens BingO at `?chat=<id>`; set `BINGO_WEB_URL` on the functions if the site is not `https://preotkrivanegk.com/bingo/`.
4. People turn it on with the card at the top of *Съобщения* or the bell. The browser asks for permission once.

**Android app**: Android's WebView has no web push and no Notification API, so the app shows new messages while it is open (toasts, the count on the tab) but nothing when it is closed. Push there needs Firebase Messaging in the Gradle build (`com.google.firebase:firebase-messaging`, `google-services.json`), a `FirebaseMessagingService` and a bridge that hands the token to `users/{uid}/push` — `chatNotify` already sends to any FCM token, so only the app side is missing. Not done here because it could not be built or tried without the Android SDK and a phone.

## How it is built

| What | Where |
|---|---|
| Rules that need no screen: chat ids, links, Google link and file types, `.gdoc` shortcuts, bubble groups, reactions, unread, who can be messaged | `src/js/80-msg-core.js` (checked by `tools/check.js`, section 11) |
| The tab, the list, the chat, files, Google Drive/Meet/Docs, viewers, demo chats | `src/js/81-messages.js`, `src/css/zzzz-messages.css` |
| Notifications: system notifications, title count, mute, web push token, `?chat=` links | `src/js/81b-msg-notify.js`; the service worker from `tools/build.py` (`push_worker`) |
| English | `src/js/49c-lang-messages.js` |
| Who is in a chat; private chats; emails for Drive sharing; push notifications | `functions/chat.js` |
| Who may read and write what | `firestore.rules` (`chats/…`), `storage.rules` (`chats/…`) |

Data: `chats/{chatId}` (`class_{classId}` or `dm_{uidA}_{uidB}`) holds `members`, `teacherIds`, `people` (names, photos, who teaches; **no emails**), `lastMessage`, `reads.{uid}`, `typing.{uid}`, `muted.{uid}`. Push tokens: `users/{uid}/push/{id}` (`token, at, ua, lang`), only the owner can read or write them. Messages are in `chats/{chatId}/messages/{id}`: `from`, `at` (server time), `text`, `files[]` (`name, size, mime, path, url, thumb, w, h`), `links[]` (`url, app, id, title, shared`), `reply`, `reactions.{uid}`, `deleted`. Files are in Storage under `chats/{chatId}/{uid}/{messageId}/`.

The rules let a member write only as themselves and only now (server time), react only for themselves, mark only their own "read"/"typing", and only the sender (or a teacher of the chat) unsend a message, which clears it. Membership and the chat's title are written only by the functions. Files: only chat members can upload (into their own folder, ≤ 25 MB) and open them.

## Tests

- `python3 tools/build.py check` — the chat rules in `80-msg-core.js` (with everything else).
- `tests/emulator/chat.test.mjs` — the security rules and functions against the Firebase emulators:
  ```bash
  npx --prefix tests/emulator firebase emulators:exec --project demo-bingo --only auth,firestore,functions,storage "node tests/emulator/chat.test.mjs"
  ```
- `tests/ui_messages.py` — the whole UI in Chromium (student on a phone, teacher on a laptop and a phone) with `tests/fake-firebase.js` instead of Firebase and Google's APIs answered by the test; no emulators needed:
  ```bash
  python3 tools/build.py web && python3 tests/ui_messages.py   # screenshots in build/shots/messages/
  ```

## Not in this version

- Push notifications in the Android app while it is closed (see above).
- Editing a sent message, voice messages recorded in the app, message search inside a chat.
- When a teacher removes a student's message, the student's file stays in Storage (only its link is gone); unsending your own message removes your files.
- Private chats stay when a student leaves the class (the history is kept); the class chat is left at once.
