# rikaigu.we

Fork of the [rikaigu](https://chrome.google.com/webstore/detail/rikaigu/gmgccdlimakdipjjogccblkaoipdklcb)
Chrome extension (version 0.9.4.2 at the time).

The goal of rikaigu.we is:

* Portable to Firefox. It uses the WebExtensions API, whose goal is compatibility across browsers.
* Extended features to support self-studying readers. Former users of the
  [Perapera Japanese Popup Dictionary](https://addons.mozilla.org/en-US/firefox/addon/perapera-kun-japanese-popup-tr/)
  Firefox addon are probably familiar with the useful feature of saving lookups
  to a wordlist in the sidebar. This project aims to bring that feature back
  and add further context information, like sentence and source website.

![](https://raw.githubusercontent.com/alextsui05/rikaigu.we/master/images/jpera-demo.gif)

# Quickstart

Currently, this extension is tested and works on Firefox 53 and Chrome 58. To
install it locally, clone this repository, then:

## Firefox

1. Go to `about:debugging`
2. Click the button to Load Temporary Add-On
3. Select the manifest.json file from the cloned directory

## Chrome

1. Go to `chrome://extensions`
2. Click the button to Load unpacked extension...
3. Select the cloned directory

The extension should install a browser action, represented by an icon in the
toolbar, to the right of the address bar.

## Warning: Windows Users

rikaigu.we ships with data in text format that relies on UNIX-style line
endings to function properly. In order to make sure of this, please disable
newline conversion by using the following git configuration before checking
out:

```
git config --global core.autocrlf=false
```

# Changelog

## Pending

* Enable saving lookups to a Rails server (codename Kiroku)
* Pressing 's' will save the current lookup to server for future reference
* Add server settings to options page

## Version 0.2.0 - 2017-06-27

* Fix deprecation in manifest to make preferences pane accessible in Firefox.
* Reset version numbers, starting from 0.1.0.

## Version 0.1.0 - 2017-05-17

* Initial fork and portability adjustments to make it work on Firefox.
