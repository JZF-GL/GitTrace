import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Tag {
  name: string
  commit?: string
  date?: string
}

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])
  const loading = ref(false)

  async function fetchTags(repoPath: string) {
    loading.value = true
    try {
      // 获取标签列表
      const result = await window.electronAPI.git.tagList(repoPath)
      const tagNames = result.all || []
      
      // 为每个标签获取指向的 commit
      const tagList: Tag[] = []
      for (const tagName of tagNames) {
        try {
          // 使用 git rev-parse 获取标签指向的 commit
          const revResult = await window.electronAPI.git.exec(repoPath, `git rev-parse ${tagName}^{commit}`)
          const commit = revResult.stdout.trim()
          tagList.push({
            name: tagName,
            commit: commit.substring(0, 7),
          })
        } catch {
          tagList.push({ name: tagName })
        }
      }
      
      tags.value = tagList
      console.log('[TagsStore] tags fetched:', tags.value)
    } catch (e) {
      console.error('[TagsStore] fetchTags error:', e)
    } finally {
      loading.value = false
    }
  }

  async function createTag(repoPath: string, tagName: string, ref?: string) {
    const result = await window.electronAPI.git.tagCreate(repoPath, tagName, ref)
    await fetchTags(repoPath)
    return result
  }

  async function deleteTag(repoPath: string, tagName: string) {
    const result = await window.electronAPI.git.tagDelete(repoPath, tagName)
    await fetchTags(repoPath)
    return result
  }

  function clear() {
    tags.value = []
  }

  return { tags, loading, fetchTags, createTag, deleteTag, clear }
})
