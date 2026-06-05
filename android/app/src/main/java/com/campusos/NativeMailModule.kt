package com.campusos

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileOutputStream
import java.util.Properties
import javax.activation.DataHandler
import javax.mail.Address
import javax.mail.BodyPart
import javax.mail.FetchProfile
import javax.mail.Flags
import javax.mail.Folder
import javax.mail.Message
import javax.mail.Multipart
import javax.mail.Part
import javax.mail.Session
import javax.mail.Store
import javax.mail.Transport
import javax.mail.UIDFolder
import javax.mail.internet.InternetAddress
import javax.mail.internet.MimeBodyPart
import javax.mail.internet.MimeMessage
import javax.mail.internet.MimeMultipart

class NativeMailModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "NativeMail"

  @ReactMethod
  fun testConnection(config: ReadableMap, promise: Promise) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val result = Arguments.createMap()
        result.putBoolean("ok", store.isConnected)
        result
      }
    }
  }

  @ReactMethod
  fun listFolders(config: ReadableMap, promise: Promise) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val arr = Arguments.createArray()
        collectFolders(store.defaultFolder, arr)
        arr
      }
    }
  }

  @ReactMethod
  fun listMessages(config: ReadableMap, folderName: String, limit: Double, promise: Promise) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val folder = openFolder(store, folderName, Folder.READ_ONLY)
        try {
          val total = folder.messageCount
          val count = limit.toInt().coerceIn(1, 100)
          val start = (total - count + 1).coerceAtLeast(1)
          val messages = if (total > 0) folder.getMessages(start, total) else emptyArray()
          val fp = FetchProfile()
          fp.add(FetchProfile.Item.ENVELOPE)
          fp.add(FetchProfile.Item.FLAGS)
          fp.add(FetchProfile.Item.CONTENT_INFO)
          folder.fetch(messages, fp)

          val arr = Arguments.createArray()
          messages.reversed().forEach { message ->
            arr.pushMap(summaryMap(folder, message))
          }
          val result = Arguments.createMap()
          result.putInt("total", total)
          result.putArray("messages", arr)
          result
        } finally {
          folder.close(false)
        }
      }
    }
  }

  @ReactMethod
  fun readMessage(config: ReadableMap, folderName: String, uid: String, promise: Promise) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val folder = openFolder(store, folderName, Folder.READ_WRITE)
        try {
          val message = messageByUid(folder, uid)
          message.setFlag(Flags.Flag.SEEN, true)
          detailMap(folder, message)
        } finally {
          folder.close(true)
        }
      }
    }
  }

  @ReactMethod
  fun setFlag(
    config: ReadableMap,
    folderName: String,
    uid: String,
    flag: String,
    value: Boolean,
    promise: Promise,
  ) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val folder = openFolder(store, folderName, Folder.READ_WRITE)
        try {
          val message = messageByUid(folder, uid)
          val mailFlag =
            when (flag) {
              "seen" -> Flags.Flag.SEEN
              "flagged" -> Flags.Flag.FLAGGED
              "deleted" -> Flags.Flag.DELETED
              else -> throw IllegalArgumentException("Unsupported flag: $flag")
            }
          message.setFlag(mailFlag, value)
          Arguments.createMap().apply { putBoolean("ok", true) }
        } finally {
          folder.close(flag == "deleted")
        }
      }
    }
  }

  @ReactMethod
  fun moveMessage(
    config: ReadableMap,
    fromFolderName: String,
    uid: String,
    toFolderName: String,
    promise: Promise,
  ) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val from = openFolder(store, fromFolderName, Folder.READ_WRITE)
        val to = store.getFolder(toFolderName)
        try {
          if (!to.exists()) {
            to.create(Folder.HOLDS_MESSAGES)
          }
          val message = messageByUid(from, uid)
          from.copyMessages(arrayOf(message), to)
          message.setFlag(Flags.Flag.DELETED, true)
          Arguments.createMap().apply { putBoolean("ok", true) }
        } finally {
          from.close(true)
        }
      }
    }
  }

  @ReactMethod
  fun downloadAttachment(
    config: ReadableMap,
    folderName: String,
    uid: String,
    partId: String,
    promise: Promise,
  ) {
    runAsync(promise) {
      connectStore(config).use { store ->
        val folder = openFolder(store, folderName, Folder.READ_ONLY)
        try {
          val message = messageByUid(folder, uid)
          val part = findPart(message, partId)
            ?: throw IllegalArgumentException("Attachment part not found")
          val fileName = sanitizeFilename(part.fileName ?: "attachment")
          val dir = File(reactContext.cacheDir, "mail-attachments").apply { mkdirs() }
          val outFile = File(dir, "${System.currentTimeMillis()}-$fileName")
          part.inputStream.use { input ->
            FileOutputStream(outFile).use { output -> input.copyTo(output) }
          }
          Arguments.createMap().apply {
            putString("path", outFile.absolutePath)
            putString("uri", "file://${outFile.absolutePath}")
            putString("name", fileName)
            putDouble("size", outFile.length().toDouble())
          }
        } finally {
          folder.close(false)
        }
      }
    }
  }

  @ReactMethod
  fun sendMessage(config: ReadableMap, draft: ReadableMap, promise: Promise) {
    runAsync(promise) {
      val props = Properties().apply {
        put("mail.smtp.host", config.string("smtpHost", "mails.tsinghua.edu.cn"))
        put("mail.smtp.port", config.int("smtpPort", 465).toString())
        put("mail.smtp.auth", "true")
        put("mail.smtp.ssl.enable", "true")
        put("mail.smtp.connectiontimeout", "20000")
        put("mail.smtp.timeout", "30000")
        put("mail.smtp.writetimeout", "30000")
      }
      val session = Session.getInstance(props)
      val message = MimeMessage(session)
      val username = config.string("username", "")
      message.setFrom(InternetAddress(username))
      setRecipients(message, Message.RecipientType.TO, draft.string("to", ""))
      setRecipients(message, Message.RecipientType.CC, draft.string("cc", ""))
      setRecipients(message, Message.RecipientType.BCC, draft.string("bcc", ""))
      message.setSubject(draft.string("subject", ""), "UTF-8")

      val text = draft.string("content", "")
      val html = "<div>${escapeHtml(text).replace("\n", "<br>")}</div>"
      val alternative = MimeMultipart("alternative")
      alternative.addBodyPart(MimeBodyPart().apply { setText(text, "UTF-8") })
      alternative.addBodyPart(MimeBodyPart().apply { setContent(html, "text/html; charset=UTF-8") })
      message.setContent(alternative)

      Transport.send(
        message,
        username,
        config.string("password", ""),
      )
      appendSentCopy(config, message)
      Arguments.createMap().apply { putBoolean("ok", true) }
    }
  }

  private fun runAsync(promise: Promise, block: () -> Any?) {
    Thread {
      try {
        promise.resolve(block())
      } catch (e: Exception) {
        promise.reject("NATIVE_MAIL_ERROR", e.message ?: "Mail operation failed", e)
      }
    }.start()
  }

  private fun connectStore(config: ReadableMap): Store {
    val props = Properties().apply {
      put("mail.store.protocol", "imaps")
      put("mail.imaps.ssl.enable", "true")
      put("mail.imaps.peek", "true")
      put("mail.imaps.connectiontimeout", "20000")
      put("mail.imaps.timeout", "30000")
      put("mail.imaps.writetimeout", "30000")
    }
    val session = Session.getInstance(props)
    val store = session.getStore("imaps")
    store.connect(
      config.string("imapHost", "mails.tsinghua.edu.cn"),
      config.int("imapPort", 993),
      config.string("username", ""),
      config.string("password", ""),
    )
    return store
  }

  private fun openFolder(store: Store, folderName: String, mode: Int): Folder {
    val folder = store.getFolder(folderName)
    if (!folder.exists()) {
      throw IllegalArgumentException("Folder does not exist: $folderName")
    }
    folder.open(mode)
    return folder
  }

  private fun messageByUid(folder: Folder, uid: String): Message {
    val uidFolder = folder as? UIDFolder
      ?: throw IllegalArgumentException("Server does not support UID")
    return uidFolder.getMessageByUID(uid.toLongOrNull() ?: -1)
      ?: throw IllegalArgumentException("Message not found")
  }

  private fun collectFolders(folder: Folder, arr: WritableArray) {
    folder.list().forEach { child ->
      if ((child.type and Folder.HOLDS_MESSAGES) != 0) {
        arr.pushMap(Arguments.createMap().apply {
          putString("name", child.name)
          putString("fullName", child.fullName)
          putString("separator", child.separator.toString())
        })
      }
      if ((child.type and Folder.HOLDS_FOLDERS) != 0) {
        collectFolders(child, arr)
      }
    }
  }

  private fun appendSentCopy(config: ReadableMap, message: MimeMessage) {
    try {
      connectStore(config).use { store ->
        val sent = findSentFolder(store) ?: return
        sent.open(Folder.READ_WRITE)
        try {
          val copy = MimeMessage(message)
          copy.setFlag(Flags.Flag.SEEN, true)
          sent.appendMessages(arrayOf(copy))
        } finally {
          sent.close(false)
        }
      }
    } catch (_: Exception) {
      // SMTP delivery has already succeeded. A missing Sent folder should not turn
      // the user-visible send result into a failure.
    }
  }

  private fun findSentFolder(store: Store): Folder? {
    val candidates = listOf(
      "Sent",
      "Sent Messages",
      "Sent Items",
      "已发送",
      "已发送邮件",
      "发件箱",
    )
    for (name in candidates) {
      try {
        val folder = store.getFolder(name)
        if (folder.exists()) return folder
      } catch (_: Exception) {
      }
    }

    val all = mutableListOf<Folder>()
    fun walk(folder: Folder) {
      folder.list().forEach { child ->
        if ((child.type and Folder.HOLDS_MESSAGES) != 0) {
          all.add(child)
        }
        if ((child.type and Folder.HOLDS_FOLDERS) != 0) {
          walk(child)
        }
      }
    }
    walk(store.defaultFolder)
    return all.firstOrNull { folder ->
      val name = folder.fullName.lowercase()
      name.contains("sent") || name.contains("已发送") || name.contains("发件")
    }
  }

  private fun summaryMap(folder: Folder, message: Message): WritableMap {
    val map = Arguments.createMap()
    map.putString("id", uidOf(folder, message))
    map.putString("folderName", folder.fullName)
    map.putString("subject", message.subject ?: "(无主题)")
    map.putArray("from", addressArray(message.from))
    map.putArray("to", addressArray(message.getRecipients(Message.RecipientType.TO)))
    map.putDouble("dateMs", (message.receivedDate ?: message.sentDate)?.time?.toDouble() ?: 0.0)
    map.putBoolean("unread", !message.flags.contains(Flags.Flag.SEEN))
    map.putBoolean("flagged", message.flags.contains(Flags.Flag.FLAGGED))
    map.putBoolean("hasAttachment", hasAttachment(message))
    map.putString("brief", previewText(message).take(180))
    return map
  }

  private fun detailMap(folder: Folder, message: Message): WritableMap {
    val parsed = ParsedContent()
    parsePart(message, "", parsed)
    val map = summaryMap(folder, message)
    map.putArray("cc", addressArray(message.getRecipients(Message.RecipientType.CC)))
    map.putString("contentText", parsed.text.trim())
    map.putString("contentHtml", parsed.html)
    map.putArray("attachments", parsed.attachments)
    map.putMap("inlineImages", parsed.inlineImages)
    return map
  }

  private fun uidOf(folder: Folder, message: Message): String {
    return ((folder as? UIDFolder)?.getUID(message) ?: message.messageNumber.toLong()).toString()
  }

  private fun addressArray(addresses: Array<Address>?): WritableArray {
    val arr = Arguments.createArray()
    addresses.orEmpty().forEach { address ->
      val map = Arguments.createMap()
      if (address is InternetAddress) {
        map.putString("name", address.personal ?: "")
        map.putString("address", address.address ?: "")
      } else {
        map.putString("name", "")
        map.putString("address", address.toString())
      }
      arr.pushMap(map)
    }
    return arr
  }

  private fun hasAttachment(part: Part): Boolean {
    if (Part.ATTACHMENT.equals(part.disposition, true)) return true
    if (part.isMimeType("multipart/*")) {
      val multipart = part.content as? Multipart ?: return false
      for (i in 0 until multipart.count) {
        if (hasAttachment(multipart.getBodyPart(i))) return true
      }
    }
    return false
  }

  private fun previewText(part: Part): String {
    return try {
      when {
        part.isMimeType("text/plain") -> part.content?.toString() ?: ""
        part.isMimeType("text/html") -> htmlToText(part.content?.toString() ?: "")
        part.isMimeType("multipart/*") -> {
          val multipart = part.content as? Multipart ?: return ""
          for (i in 0 until multipart.count) {
            val text = previewText(multipart.getBodyPart(i))
            if (text.isNotBlank()) return text
          }
          ""
        }
        else -> ""
      }.replace(Regex("\\s+"), " ").trim()
    } catch (_: Exception) {
      ""
    }
  }

  private fun parsePart(part: Part, path: String, parsed: ParsedContent) {
    val disposition = part.disposition ?: ""
    val fileName = part.fileName
    val currentPath = path.ifBlank { "1" }
    when {
      part.isMimeType("text/plain") && !Part.ATTACHMENT.equals(disposition, true) -> {
        val text = part.content?.toString() ?: ""
        if (parsed.text.isBlank()) parsed.text = text
      }
      part.isMimeType("text/html") && !Part.ATTACHMENT.equals(disposition, true) -> {
        val html = part.content?.toString() ?: ""
        if (parsed.html.isBlank()) parsed.html = html
        if (parsed.text.isBlank()) parsed.text = htmlToText(html)
      }
      part.isMimeType("multipart/*") -> {
        val multipart = part.content as? Multipart ?: return
        for (i in 0 until multipart.count) {
          parsePart(multipart.getBodyPart(i), "$currentPath.${i + 1}", parsed)
        }
      }
      fileName != null || Part.ATTACHMENT.equals(disposition, true) || Part.INLINE.equals(disposition, true) -> {
        val contentId = part.getHeader("Content-ID")?.firstOrNull()?.trim('<', '>')
        val size = try {
          part.size.toDouble()
        } catch (_: Exception) {
          0.0
        }
        if (Part.INLINE.equals(disposition, true) && contentId != null && size <= 2_000_000) {
          val bytes = part.inputStream.readBytes()
          val dataUri =
            "data:${part.contentType.substringBefore(';')};base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
          parsed.inlineImages.putString(contentId, dataUri)
        } else {
          parsed.attachments.pushMap(Arguments.createMap().apply {
            putString("id", currentPath)
            putString("name", fileName ?: "附件")
            putString("mimeType", part.contentType.substringBefore(';'))
            putDouble("size", size)
            putBoolean("inline", Part.INLINE.equals(disposition, true))
            putString("contentId", contentId ?: "")
          })
        }
      }
    }
  }

  private fun findPart(part: Part, wantedPath: String, path: String = "1"): Part? {
    if (path == wantedPath) return part
    if (part.isMimeType("multipart/*")) {
      val multipart = part.content as? Multipart ?: return null
      for (i in 0 until multipart.count) {
        val found = findPart(multipart.getBodyPart(i), wantedPath, "$path.${i + 1}")
        if (found != null) return found
      }
    }
    return null
  }

  private fun setRecipients(message: MimeMessage, type: Message.RecipientType, raw: String) {
    val trimmed = raw.trim()
    if (trimmed.isNotEmpty()) {
      message.setRecipients(type, InternetAddress.parse(trimmed, false))
    }
  }

  private fun sanitizeFilename(value: String): String {
    return value.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(120).ifBlank { "attachment" }
  }

  private fun escapeHtml(value: String): String {
    return value
      .replace("&", "&amp;")
      .replace("<", "&lt;")
      .replace(">", "&gt;")
      .replace("\"", "&quot;")
  }

  private fun htmlToText(html: String): String {
    return html
      .replace(Regex("(?is)<br\\s*/?>"), "\n")
      .replace(Regex("(?is)</p>"), "\n")
      .replace(Regex("(?is)<style.*?</style>"), "")
      .replace(Regex("(?is)<script.*?</script>"), "")
      .replace(Regex("(?is)<[^>]+>"), "")
      .replace("&nbsp;", " ")
      .replace("&amp;", "&")
      .replace("&lt;", "<")
      .replace("&gt;", ">")
      .replace("&quot;", "\"")
      .trim()
  }

  private fun ReadableMap.string(key: String, fallback: String): String {
    return if (hasKey(key) && !isNull(key)) getString(key) ?: fallback else fallback
  }

  private fun ReadableMap.int(key: String, fallback: Int): Int {
    return if (hasKey(key) && !isNull(key)) getDouble(key).toInt() else fallback
  }

  private class ParsedContent {
    var text: String = ""
    var html: String = ""
    val attachments: WritableArray = Arguments.createArray()
    val inlineImages: WritableMap = Arguments.createMap()
  }
}
