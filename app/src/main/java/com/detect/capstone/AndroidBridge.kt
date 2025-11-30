package com.detect.capstone

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.DocumentsContract
import android.webkit.JavascriptInterface
import android.widget.Toast

class AndroidBridge(private val activity: MainActivity) {

    private var pendingCsvName: String? = null
    private var pendingCsvContent: String? = null
    private var pendingKmlName: String? = null
    private var pendingKmlContent: String? = null

    // Called from JS
    @JavascriptInterface
    fun exportFiles(csvName: String, csvContent: String,
                    kmlName: String, kmlContent: String) {

        val folderUri = activity.exportFolderUri

        // If user hasn't selected a folder yet
        if (folderUri == null) {
            pendingCsvName = csvName
            pendingCsvContent = csvContent
            pendingKmlName = kmlName
            pendingKmlContent = kmlContent

            Handler(Looper.getMainLooper()).post {
                activity.pickExportFolder()
            }
            return
        }

        // ALWAYS ensure Capstone Files subfolder exists
        val capstoneFolderUri = ensureSubfolder(folderUri, "Capstone Files")
        if (capstoneFolderUri == null) {
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(activity,
                    "Failed to create Capstone Files folder",
                    Toast.LENGTH_LONG
                ).show()
            }
            return
        }

        // Save INTO THE SUBFOLDER
        saveFile(capstoneFolderUri, csvName, csvContent)
        saveFile(capstoneFolderUri, kmlName, kmlContent)

        Handler(Looper.getMainLooper()).post {
            Toast.makeText(activity, "Export complete!", Toast.LENGTH_LONG).show()
        }
    }

    fun exportPendingFiles() {
        exportFiles(
            pendingCsvName ?: return,
            pendingCsvContent ?: return,
            pendingKmlName ?: return,
            pendingKmlContent ?: return
        )
        pendingCsvName = null
        pendingCsvContent = null
        pendingKmlName = null
        pendingKmlContent = null
    }

    // SAF-safe subfolder creation
    private fun ensureSubfolder(parentTreeUri: Uri, folderName: String): Uri? {
        val resolver = activity.contentResolver

        val parentId = DocumentsContract.getTreeDocumentId(parentTreeUri)

        val parentDocUri = DocumentsContract.buildDocumentUriUsingTree(
            parentTreeUri,
            parentId
        )

        // Scan children for existing folder
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
            parentTreeUri,
            parentId
        )

        resolver.query(
            childrenUri,
            arrayOf(
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_DOCUMENT_ID
            ),
            null,
            null,
            null
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val name = cursor.getString(0)
                val docId = cursor.getString(1)
                if (name == folderName) {
                    return DocumentsContract.buildDocumentUriUsingTree(
                        parentTreeUri,
                        docId
                    )
                }
            }
        }

        // Create new subfolder
        return DocumentsContract.createDocument(
            resolver,
            parentDocUri,
            DocumentsContract.Document.MIME_TYPE_DIR,
            folderName
        )
    }

    // SAF-safe file creation
    private fun saveFile(folderUri: Uri, fileName: String, content: String) {
        try {
            val resolver = activity.contentResolver

            val folderDocId = DocumentsContract.getDocumentId(folderUri)

            val folderDocUri = DocumentsContract.buildDocumentUriUsingTree(
                folderUri,
                folderDocId
            )

            val fileUri = DocumentsContract.createDocument(
                resolver,
                folderDocUri,
                "application/octet-stream",
                fileName
            )

            if (fileUri == null) throw Exception("Failed to create file")

            resolver.openOutputStream(fileUri)?.use { os ->
                os.write(content.toByteArray())
            }

        } catch (e: Exception) {
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(activity, "Save error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}
