<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
// Open Graph / Twitter card images must be absolute URLs for most scrapers
// (Facebook, LinkedIn, iMessage, Slack). Pin them to the canonical production
// domain so previews are identical no matter where the page is served from.
const siteUrl = 'https://psy-kick.me'
const ogImage = `${siteUrl}/img/social-preview.png`

const title = 'psy_kick: structured remote viewing practice'
const description
  = 'Remote viewing practice with blind sessions and score tracking. We\'ll '
  + 'pick a secret target image, you remote-view it, and then see how you scored.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'website',
  ogSiteName: 'psy_kick',
  ogUrl: siteUrl,
  ogImage,
  ogImageWidth: 1196,
  ogImageHeight: 626,
  ogImageAlt: 'psy_kick — remote viewing practice',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: ogImage,
})

useHead({
  link: [{ rel: 'canonical', href: siteUrl }],
})
</script>
