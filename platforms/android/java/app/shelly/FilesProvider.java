package app.shelly;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/* Lets other apps (Viber, Telegram, Gmail…) read a module file the user chose to send.
   Only the one file in cache/out/ can be read, and only by an app the user picked. */
public class FilesProvider extends ContentProvider {
    static String safeName(String n) {
        if (n == null || n.trim().isEmpty()) return "module.zip";
        n = n.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1F]", "_").trim();
        return n.length() > 120 ? n.substring(n.length() - 120) : n;
    }

    File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.equals(safeName(name)) || name.startsWith(".")) throw new FileNotFoundException();
        File f = new File(new File(getContext().getCacheDir(), "out"), name);
        if (!f.isFile()) throw new FileNotFoundException();
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        try {
            File f = fileFor(uri);
            MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[]{f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) { return null; }
    }

    @Override public String getType(Uri uri) { return "application/zip"; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] args) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { return 0; }
}
