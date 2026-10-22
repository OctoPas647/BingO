&#x20;  # BingO – rules for AI agents



&#x20;  ## Git

&#x20;  - Work only on the current ai/... branch. Never commit to or push main.

&#x20;  - After finishing a task: run the build and tests, then `git add -A` and `git commit -m "<short description>"`.

&#x20;  - Never force-push. Never rewrite history.



&#x20;  ## Build

&#x20;  - Build: `.\\gradlew.bat assembleDebug`

&#x20;  - Tests: `.\\gradlew.bat testDebugUnitTest`

&#x20;  - The build and tests must pass before you commit.



&#x20;  ## Don't touch

&#x20;  - Keystores (\*.jks, \*.keystore), local.properties, keystore.properties, signing configs.

&#x20;  - Gradle/AGP/Kotlin versions and dependencies, unless the task says so.



&#x20;  ## Code style

&#x20;  - Keep changes small and focused on the task; no mass reformatting.

&#x20;  - Follow the existing architecture. Put UI text in res/values/strings.xml (the app's text is in Bulgarian).

&#x20;  - Never delete tests to make them pass.

