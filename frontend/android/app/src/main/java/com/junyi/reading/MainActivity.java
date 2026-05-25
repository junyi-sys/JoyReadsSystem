package com.junyi.reading;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onStart() {
    super.onStart();
    // Allow audio playback without user gesture in WebView
    WebView webView = getBridge().getWebView();
    webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
  }
}
