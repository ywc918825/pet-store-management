<template>
  <router-view v-slot="{ Component }">
    <component :is="Component" />
  </router-view>
</template>

<script setup>
// Root application shell
</script>

<style scoped>
</style>
