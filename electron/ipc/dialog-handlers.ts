import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerDialogHandlers() {
  ipcMain.handle('dialog:open-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: '选择 Git 仓库目录',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
