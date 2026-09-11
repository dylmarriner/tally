<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { initializeProvider, type ProviderStatus } from './lib/nimiq-provider'
const status = ref<ProviderStatus>({ state: 'initializing', message: 'Checking for Nimiq Pay…' })
async function retry(): Promise<void> { status.value = await initializeProvider() }
onMounted(() => { void retry() })
</script>
<template>
  <main class="shell">
    <header><span class="eyebrow">TALLY</span><span class="status-dot" :class="status.state" aria-label="provider status"></span></header>
    <section class="hero"><p class="eyebrow">SHARED EXPENSES, SETTLED CLEANLY</p><h1>Keep the maths<br><em>out of the friendship.</em></h1><p class="lede">Tally keeps group expenses clear, calculates fair balances, and lets you settle in NIM.</p></section>
    <section class="provider" aria-live="polite"><strong>{{ status.state === 'initializing' ? 'Connecting…' : status.state === 'ready' ? 'Nimiq Pay ready' : 'Nimiq Pay not detected' }}</strong><p>{{ status.message }}</p><button v-if="status.state !== 'ready'" type="button" @click="retry">Retry connection</button></section>
    <button class="primary" type="button" :disabled="status.state === 'initializing'">Continue</button>
    <p class="fine-print">No wallet prompt happens until you choose to connect.</p>
  </main>
</template>
