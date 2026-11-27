package com.aerial.mobile

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory
import okhttp3.CacheControl
import java.util.concurrent.TimeUnit

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Allow static GitHub Pages OTA JSON manifests to work directly with expo-updates
    // by injecting the protocol version header and bypassing stale disk cache for manifest JSON.
    OkHttpClientProvider.setOkHttpClientFactory(
      OkHttpClientFactory {
        OkHttpClientProvider.createClientBuilder()
          .connectTimeout(15, TimeUnit.SECONDS)
          .readTimeout(20, TimeUnit.SECONDS)
          .writeTimeout(15, TimeUnit.SECONDS)
          .callTimeout(30, TimeUnit.SECONDS)
          .addInterceptor { chain ->
            val originalRequest = chain.request()
            val url = originalRequest.url.toString()
            val isOtaManifest =
              url.startsWith("https://trimzyxd.github.io/aerial-mobile/ota/") && url.endsWith(".json")
            val request = if (isOtaManifest) {
              originalRequest.newBuilder()
                .cacheControl(CacheControl.FORCE_NETWORK)
                .build()
            } else {
              originalRequest
            }
            val response = chain.proceed(request)
            if (isOtaManifest && response.isSuccessful && response.header("expo-protocol-version") == null) {
              response.newBuilder()
                .header("expo-protocol-version", "0")
                .build()
            } else {
              response
            }
          }
          .build()
      }
    )

    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
