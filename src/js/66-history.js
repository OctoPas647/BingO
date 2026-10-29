/* ================= Bottom menu: history sync =================
   Retired: src/js/67-history-sync.js already delays history syncing while a trap
   removal (history.back()) is pending, which also covers fast switches between
   Начало, Статистики and Профил in the bottom menu.

   This file no longer overrides anything. It is kept only so the build order and
   the bottom-menu regression test in tests/fixes.py keep their historical context;
   having two history-sync patches could make browser/Android Back unpredictable. */
