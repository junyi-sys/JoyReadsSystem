package com.junyi.reading;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {
  private static final int AUDIO_PERMISSION_CODE = 1001;
  private MediaRecorder mediaRecorder;
  private File outputFile;
  private String pendingCallback;

  @Override
  public void onStart() {
    super.onStart();
    WebView webView = getBridge().getWebView();
    webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
    // Expose native recorder to JS
    webView.addJavascriptInterface(this, "NativeAudio");
  }

  /** Called from JS: NativeAudio.startRecord(callbackId) */
  @JavascriptInterface
  public void startRecord(String callbackId) {
    pendingCallback = callbackId;
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this,
          new String[]{Manifest.permission.RECORD_AUDIO},
          AUDIO_PERMISSION_CODE);
    } else {
      beginRecording();
    }
  }

  /** Called from JS: NativeAudio.stopRecord() */
  @JavascriptInterface
  public void stopRecord() {
    finishRecording();
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == AUDIO_PERMISSION_CODE) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        beginRecording();
      } else {
        fireCallback("error", "PERMISSION_DENIED");
      }
    }
  }

  private void beginRecording() {
    try {
      outputFile = File.createTempFile("voice_", ".m4a", getCacheDir());
      mediaRecorder = new MediaRecorder();
      mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
      mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
      mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
      mediaRecorder.setAudioSamplingRate(44100);
      mediaRecorder.setAudioEncodingBitRate(96000);
      mediaRecorder.setOutputFile(outputFile.getAbsolutePath());
      mediaRecorder.prepare();
      mediaRecorder.start();
      fireCallback("started", "");
    } catch (IOException e) {
      fireCallback("error", e.getMessage());
    }
  }

  private void finishRecording() {
    try {
      if (mediaRecorder != null) {
        mediaRecorder.stop();
        mediaRecorder.release();
        mediaRecorder = null;
      }
      if (outputFile != null && outputFile.exists()) {
        FileInputStream fis = new FileInputStream(outputFile);
        byte[] bytes = new byte[(int) outputFile.length()];
        fis.read(bytes);
        fis.close();
        String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        outputFile.delete();
        fireCallback("data", b64);
      } else {
        fireCallback("error", "No audio data");
      }
    } catch (IOException e) {
      fireCallback("error", e.getMessage());
    }
  }

  private void fireCallback(String type, String payload) {
    if (pendingCallback == null) return;
    final String js = "window._nativeAudioCallback('" + pendingCallback + "','" + type + "','" + payload.replace("\\", "\\\\").replace("'", "\\'") + "')";
    runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
  }
}
