<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { initializeProvider, type ProviderStatus } from './lib/nimiq-provider'
import {
  beginConnect,
  completeConnect,
  refreshCurrentUser,
  session,
  setDisplayName,
  signOut,
} from './features/auth/session'

const status = ref<ProviderStatus>({ state: 'initializing', message: 'Checking for Nimiq Pay…' })
const displayNameDraft = ref('')

async function retry(): Promise<void> {
  status.value = { state: 'initializing', message: 'Checking for Nimiq Pay…' }
  status.value = await initializeProvider()
}

onMounted(async () => {
  await refreshCurrentUser()
  await retry()
})

async function onConnect(): Promise<void> {
  await beginConnect()
}

async function onPickAddress(addr: string): Promise<void> {
  await completeConnect(addr)
}

async function onSubmitDisplayName(): Promise<void> {
  const value = displayNameDraft.value.trim()
  if (value.length === 0) return
  await setDisplayName(value)
  displayNameDraft.value = ''
}
</script>

<template>
  <main class="shell">
    <header>
      <span class="eyebrow">TALLY</span>
      <span
        class="status-dot"
        :class="status.state"
        aria-label="provider status"
      />
    </header>

    <section class="hero">
      <p class="eyebrow">
        SHARED EXPENSES, SETTLED CLEANLY
      </p>
      <h1>Keep the maths<br><em>out of the friendship.</em></h1>
      <p class="lede">
        Tally keeps group expenses clear, calculates fair balances, and lets you settle in NIM.
      </p>
    </section>

    <section
      class="provider"
      aria-live="polite"
    >
      <strong>
        {{
          status.state === 'initializing'
            ? 'Connecting…'
            : status.state === 'ready'
              ? 'Nimiq Pay ready'
              : 'Nimiq Pay not detected'
        }}
      </strong>
      <p>{{ status.message }}</p>
      <button
        v-if="status.state !== 'ready' && status.state !== 'initializing'"
        type="button"
        @click="retry"
      >
        Retry connection
      </button>
    </section>

    <section
      v-if="!session.user"
      class="auth"
      aria-live="polite"
    >
      <button
        class="primary"
        type="button"
        :disabled="status.state !== 'ready' || session.phase === 'requesting-accounts' || session.phase === 'awaiting-signature' || session.phase === 'verifying'"
        @click="onConnect"
      >
        {{
          session.phase === 'requesting-accounts'
            ? 'Requesting wallet…'
            : session.phase === 'awaiting-signature'
              ? 'Waiting for signature…'
              : session.phase === 'verifying'
                ? 'Verifying…'
                : 'Sign in with Nimiq Pay'
        }}
      </button>

      <div
        v-if="session.candidateAddresses.length > 1 && session.phase === 'awaiting-signature'"
        class="address-picker"
      >
        <p>Pick the wallet to use with Tally:</p>
        <ul>
          <li
            v-for="addr in session.candidateAddresses"
            :key="addr"
          >
            <button
              type="button"
              @click="onPickAddress(addr)"
            >
              {{ addr }}
            </button>
          </li>
        </ul>
      </div>

      <p
        v-if="session.error"
        class="error"
        role="alert"
      >
        {{ session.error }}
      </p>
      <p class="fine-print">
        No wallet prompt happens until you choose to connect.
      </p>
    </section>

    <section
      v-else-if="session.phase === 'awaiting-display-name'"
      class="auth"
    >
      <h2>Welcome to Tally</h2>
      <p>Pick a display name your groups will see.</p>
      <form @submit.prevent="onSubmitDisplayName">
        <label>
          Display name
          <input
            v-model="displayNameDraft"
            type="text"
            maxlength="40"
            required
          >
        </label>
        <p class="fine-print">
          Currently shown as {{ session.user.displayName }}.
        </p>
        <button
          class="primary"
          type="submit"
        >
          Save
        </button>
      </form>
      <p
        v-if="session.error"
        class="error"
        role="alert"
      >
        {{ session.error }}
      </p>
    </section>

    <section
      v-else
      class="auth"
    >
      <h2>Signed in</h2>
      <p><strong>{{ session.user.displayName }}</strong></p>
      <p class="fine-print">
        {{ session.user.nimiqAddress }}
      </p>
      <button
        type="button"
        @click="signOut"
      >
        Sign out
      </button>
      <p
        v-if="session.error"
        class="error"
        role="alert"
      >
        {{ session.error }}
      </p>
    </section>
  </main>
</template>
