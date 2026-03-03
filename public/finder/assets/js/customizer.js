(() => {
  'use strict'

  // Helper functions for local storage access
  const getFromStorage = item => localStorage.getItem(item)
  const setToStorage = (item, value) => localStorage.setItem(item, value)

  // Helper function for setting RTL / LTR direction
  const setDirection = (direction) => {
    document.documentElement.setAttribute('dir', direction)
    const link = document.getElementById('theme-styles')
    const href = link.getAttribute('href')
    if (direction === 'rtl') {
      link.setAttribute('href', href.replace('theme.min.css', 'theme.rtl.min.css'))
    } else {
      link.setAttribute('href', href.replace('theme.rtl.min.css', 'theme.min.css'))
    }
  }

  // Helper functions for converting HEX to RGB colors
  const hexToRGB = (h) => {
    let r = 0, g = 0, b = 0
    if (h.length == 4) {
      r = "0x" + h[1] + h[1]
      g = "0x" + h[2] + h[2]
      b = "0x" + h[3] + h[3]
    } else if (h.length == 7) {
      r = "0x" + h[1] + h[2]
      g = "0x" + h[3] + h[4]
      b = "0x" + h[5] + h[6]
    }
    return `${+r},${+g},${+b}`
  }

  // Helper functions for converting RGB to HEX colors
  const rgbToHex = (r, g, b) => {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16)
          return hex.length === 1 ? '0' + hex : hex
        })
        .join('')
    )
  }

  // Helper functions for mixing two colors based on a given percentage
  const mixColors = (color1, color2, percentage) => {
    const weight = Math.max(0, Math.min(100, percentage)) / 100

    // Parse RGB values from the hexToRGB output
    const parseRGB = (color) => {
      return color.split(',').map((x) => parseInt(x))
    }

    const rgb1 = parseRGB(hexToRGB(color1))
    const rgb2 = parseRGB(hexToRGB(color2))

    // Calculate the mixed color components
    const mixedR = Math.round(rgb1[0] * weight + rgb2[0] * (1 - weight))
    const mixedG = Math.round(rgb1[1] * weight + rgb2[1] * (1 - weight))
    const mixedB = Math.round(rgb1[2] * weight + rgb2[2] * (1 - weight))

    // Convert mixed RGB back to hex
    return rgbToHex(mixedR, mixedG, mixedB)
  }

  // Helper functions for generating color shades, similar to Sass adjust-color / scale-color functions
  const shadeColor = (color, percent) => {
    var num = parseInt(color.replace('#',''),16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    B = (num >> 8 & 0x00FF) + amt,
    G = (num & 0x0000FF) + amt
    return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1)
  }

  // Helper function to replace 'left' and 'right' in class names
  const swapDirection = (className) => {
    return className.replace(/left|right/gi, matched => {
      return matched === 'left' ? 'right' : 'left'
    })
  }


  // CSS variables prefix
  const themePrefix = 'fn-'

  // Generated stylesheet rules that are stored in localStorage
  const themeColorKeys = ['primary', 'success', 'warning', 'danger', 'info']
  const generatedStylesheetRules = `
    :root, [data-bs-theme="light"] {
      ${themeColorKeys.map(color => {
        return `
          ${getFromStorage(`theme-${color}`) && `--${themePrefix}${color}: ${getFromStorage(`theme-${color}`)};`}
          ${getFromStorage(`theme-${color}-rgb`) && `--${themePrefix}${color}-rgb: ${getFromStorage(`theme-${color}-rgb`)};`}
          ${getFromStorage(`theme-${color}-text-emphasis`) && `--${themePrefix}${color}-text-emphasis: ${getFromStorage(`theme-${color}-text-emphasis`)};`}
          ${getFromStorage(`theme-${color}-bg-subtle`) && `--${themePrefix}${color}-bg-subtle: ${getFromStorage(`theme-${color}-bg-subtle`)};`}
          ${getFromStorage(`theme-${color}-border-subtle`) && `--${themePrefix}${color}-border-subtle: ${getFromStorage(`theme-${color}-border-subtle`)};`}
        `
      }).join('\n')}
      ${getFromStorage('theme-border-width') && `--${themePrefix}border-width: ${getFromStorage('theme-border-width')};`}
      ${getFromStorage('theme-border-radius') && `--${themePrefix}border-radius: ${getFromStorage('theme-border-radius')};`}
    }
    [data-bs-theme="dark"] {
      ${themeColorKeys.map(color => {
        return `
          ${getFromStorage(`theme-${color}-text-emphasis-dark`) && `--${themePrefix}${color}-text-emphasis: ${getFromStorage(`theme-${color}-text-emphasis-dark`)};`}
          ${getFromStorage(`theme-${color}-bg-subtle-dark`) && `--${themePrefix}${color}-bg-subtle: ${getFromStorage(`theme-${color}-bg-subtle-dark`)};`}
          ${getFromStorage(`theme-${color}-border-subtle-dark`) && `--${themePrefix}${color}-border-subtle: ${getFromStorage(`theme-${color}-border-subtle-dark`)};`}
        `
      }).join('\n')}
    }
    ${themeColorKeys.map(color => {
      return `.btn-${color} {
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-bg: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-border-color: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`) && `--${themePrefix}btn-hover-bg: ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`)};`}
        ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`) && `--${themePrefix}btn-hover-border-color: ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`)};`}
        ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`) && `--${themePrefix}btn-active-bg: ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`)};`}
        ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`) && `--${themePrefix}btn-active-border-color: ${getFromStorage(`theme-${color}-btn-hover-active-border-bg-color`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-disabled-bg: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-disabled-border-color: ${getFromStorage(`theme-${color}`)};`}
      }`
    }).join('\n')}
    ${themeColorKeys.map(color => {
      return `.btn-outline-${color} {
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-color: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-border-color: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-hover-bg: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-hover-border-color: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-active-bg: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-active-border-color: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-disabled-color: ${getFromStorage(`theme-${color}`)};`}
        ${getFromStorage(`theme-${color}`) && `--${themePrefix}btn-disabled-border-color: ${getFromStorage(`theme-${color}`)};`}
        }`
    }).join('\n')}
  `

  // Format generatedStylesheetRules
  const generatedStylesheetRulesFormatted = generatedStylesheetRules.replace(/null|\s*(?![A-Z])/g, '')


  // Creating <style> tag and appending it <head>
  const style = document.createElement('style')
  style.id = 'customizer-styles'
  style.textContent = generatedStylesheetRulesFormatted
  document.head.appendChild(style)


  // Set the direction using the value retrieved from localStorage or the default on page load
  const currentDirection = getFromStorage('direction') || 'ltr'
  setDirection(currentDirection)


  // This wrapper is to ensure that DOM content is fully loaded before executing functions that manipulate DOM nodes
  window.addEventListener('DOMContentLoaded', () => {
    const generatedStylesheet = document.getElementById('customizer-styles')

    // Creating styleRules object
    const styleRules = {
      root: generatedStylesheet.sheet.cssRules[0],
      dark: generatedStylesheet.sheet.cssRules[1],
      primaryBtn: generatedStylesheet.sheet.cssRules[2],
      successBtn: generatedStylesheet.sheet.cssRules[3],
      warningBtn: generatedStylesheet.sheet.cssRules[4],
      dangerBtn: generatedStylesheet.sheet.cssRules[5],
      infoBtn: generatedStylesheet.sheet.cssRules[6],
      primaryOutlineBtn: generatedStylesheet.sheet.cssRules[7],
      successOutlineBtn: generatedStylesheet.sheet.cssRules[8],
      warningOutlineBtn: generatedStylesheet.sheet.cssRules[9],
      dangerOutlineBtn: generatedStylesheet.sheet.cssRules[10],
      infoOutlineBtn: generatedStylesheet.sheet.cssRules[11]
    }


    // Add generated styles to preview window inside 'Show code' collapse
    const generatedStylesPreview = document.querySelector('#generated-styles')
    generatedStylesheetRulesFormatted.split('}').map((item) => {
      if (item.indexOf('{--') !== -1) {
        generatedStylesPreview.append(item + '}')
      }
    })


    // Add / update generated styles to preview window inside 'Show code' collapse
    const updateStylesPreview = () => {
      generatedStylesPreview.innerHTML = styleRules.root.cssText.replace(/null|\s*(?![A-Z])/g,'')
      generatedStylesPreview.innerHTML += styleRules.dark.cssText.indexOf('{ }') === -1 ? styleRules.dark.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.primaryBtn.cssText.indexOf('{ }') === -1 ? styleRules.primaryBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.successBtn.cssText.indexOf('{ }') === -1 ? styleRules.successBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.warningBtn.cssText.indexOf('{ }') === -1 ? styleRules.warningBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.dangerBtn.cssText.indexOf('{ }') === -1 ? styleRules.dangerBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.infoBtn.cssText.indexOf('{ }') === -1 ? styleRules.infoBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.primaryOutlineBtn.cssText.indexOf('{ }') === -1 ? styleRules.primaryOutlineBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.successOutlineBtn.cssText.indexOf('{ }') === -1 ? styleRules.successOutlineBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.warningOutlineBtn.cssText.indexOf('{ }') === -1 ? styleRules.warningOutlineBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.dangerOutlineBtn.cssText.indexOf('{ }') === -1 ? styleRules.dangerOutlineBtn.cssText.replace(/ /g,'') : ''
      generatedStylesPreview.innerHTML += styleRules.infoOutlineBtn.cssText.indexOf('{ }') === -1 ? styleRules.infoOutlineBtn.cssText.replace(/ /g,'') : ''
    }


    // Change icon direction if the current direction is 'rtl'
    if (currentDirection === 'rtl') {
      const icons = document.querySelectorAll('[class*="fi-"]')

      icons.forEach((icon) => {
        icon.className = icon.className
          .split(' ')
          .map((cls) => {
            if (cls.includes('left') || cls.includes('right')) {
              return swapDirection(cls)
            }
            return cls
          })
          .join(' ')
      })
    }


    // Theme colors controls
    const themeColors = document.querySelectorAll('#theme-colors .color-swatch')
    themeColors.forEach((color) => {
      const colorPreview = color.querySelector('label')
      const colorPicker = color.querySelector('input[type="color"]')
      const colorInput = color.querySelector('input[type="text"]')

      colorInput.value = getFromStorage(color.id) || colorInput.value
      colorPicker.value = getFromStorage(color.id) || colorPicker.value
      colorPreview.style.backgroundColor = getFromStorage(color.id) || colorPicker.value

      // Color picker change event
      colorPicker.addEventListener('input', (e) => {
        const colorPreview = e.target.parentElement.querySelector('label')
        const colorInput = e.target.parentElement.querySelector('input[type="text"]')
        const colorValue = e.target.value

        setToStorage('theme-' + e.target.id, colorValue)
        setToStorage('theme-' + e.target.id + '-rgb', hexToRGB(colorValue))
        setToStorage('theme-' + e.target.id + '-text-emphasis', shadeColor(colorValue, -10))
        setToStorage('theme-' + e.target.id + '-bg-subtle', mixColors('#ffffff', colorValue, 90))
        setToStorage('theme-' + e.target.id + '-border-subtle', mixColors('#ffffff', colorValue, 80))
        setToStorage('theme-' + e.target.id + '-text-emphasis-dark', shadeColor(colorValue, -5))
        setToStorage('theme-' + e.target.id + '-bg-subtle-dark', mixColors('#111827', colorValue, 90))
        setToStorage('theme-' + e.target.id + '-border-subtle-dark', mixColors('#111827', colorValue, 80))
        setToStorage('theme-' + e.target.id + '-btn-hover-active-border-bg-color', shadeColor(colorValue, -10))
        colorPreview.style.backgroundColor = colorValue
        colorInput.value = colorValue
        styleRules.root.style.setProperty('--' + themePrefix + e.target.id, colorValue)
        styleRules.root.style.setProperty('--' + themePrefix + e.target.id + '-rgb', hexToRGB(colorValue))
        styleRules.root.style.setProperty('--' + themePrefix + e.target.id + '-text-emphasis', shadeColor(colorValue, -10))
        styleRules.root.style.setProperty('--' + themePrefix + e.target.id + '-bg-subtle', mixColors('#ffffff', colorValue, 90))
        styleRules.root.style.setProperty('--' + themePrefix + e.target.id + '-border-subtle', mixColors('#ffffff', colorValue, 80))
        styleRules.dark.style.setProperty('--' + themePrefix + e.target.id + '-text-emphasis', shadeColor(colorValue, -5))
        styleRules.dark.style.setProperty('--' + themePrefix + e.target.id + '-bg-subtle', mixColors('#111827', colorValue, 90))
        styleRules.dark.style.setProperty('--' + themePrefix + e.target.id + '-border-subtle', mixColors('#111827', colorValue, 80))
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-bg', colorValue)
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-border-color', colorValue)
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-hover-bg', shadeColor(colorValue, -10))
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-hover-border-color', shadeColor(colorValue, -10))
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-active-bg', shadeColor(colorValue, -10))
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-active-border-color', shadeColor(colorValue, -10))
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-disabled-bg', colorValue)
        styleRules[e.target.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-disabled-border-color', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-color', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-border-color', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-hover-bg', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-hover-border-color', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-active-bg', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-active-border-color', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-disabled-color', colorValue)
        styleRules[e.target.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-disabled-border-color', colorValue)

        updateStylesPreview()
      })

      // Color input change event
      colorInput.addEventListener('change', (e) => {
        const colorPreview = e.target.parentElement.querySelector('label')
        const colorPicker = e.target.parentElement.querySelector('input[type="color"]')
        const colorValue = e.target.value

        if(colorValue.length != 0 && colorValue.startsWith('#')) {
          setToStorage('theme-' + colorPicker.id, colorValue)
          setToStorage('theme-' + colorPicker.id + '-rgb', hexToRGB(colorValue))
          setToStorage('theme-' + colorPicker.id + '-text-emphasis', shadeColor(colorValue, -10))
          setToStorage('theme-' + colorPicker.id + '-bg-subtle', mixColors('#ffffff', colorValue, 90))
          setToStorage('theme-' + colorPicker.id + '-border-subtle', mixColors('#ffffff', colorValue, 80))
          setToStorage('theme-' + colorPicker.id + '-text-emphasis-dark', shadeColor(colorValue, -5))
          setToStorage('theme-' + colorPicker.id + '-bg-subtle-dark', mixColors('#111827', colorValue, 90))
          setToStorage('theme-' + colorPicker.id + '-border-subtle-dark', mixColors('#111827', colorValue, 80))
          setToStorage('theme-' + colorPicker.id + '-btn-hover-active-border-bg-color', shadeColor(colorValue, -10))
          colorPreview.style.backgroundColor = colorValue
          colorPicker.value = colorValue
          styleRules.root.style.setProperty('--' + themePrefix + colorPicker.id, colorValue)
          styleRules.root.style.setProperty('--' + themePrefix + colorPicker.id + '-rgb', hexToRGB(colorValue))
          styleRules.root.style.setProperty('--' + themePrefix + colorPicker.id + '-text-emphasis', shadeColor(colorValue, -10))
          styleRules.root.style.setProperty('--' + themePrefix + colorPicker.id + '-bg-subtle', mixColors('#ffffff', colorValue, 90))
          styleRules.root.style.setProperty('--' + themePrefix + colorPicker.id + '-border-subtle', mixColors('#ffffff', colorValue, 80))
          styleRules.dark.style.setProperty('--' + themePrefix + colorPicker.id + '-text-emphasis', shadeColor(colorValue, -5))
          styleRules.dark.style.setProperty('--' + themePrefix + colorPicker.id + '-bg-subtle', mixColors('#111827', colorValue, 90))
          styleRules.dark.style.setProperty('--' + themePrefix + colorPicker.id + '-border-subtle', mixColors('#111827', colorValue, 80))
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-bg', colorValue)
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-border-color', colorValue)
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-hover-bg', shadeColor(colorValue, -10))
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-hover-border-color', shadeColor(colorValue, -10))
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-active-bg', shadeColor(colorValue, -10))
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-active-border-color', shadeColor(colorValue, -10))
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-disabled-bg', colorValue)
          styleRules[colorPicker.id + 'Btn'].style.setProperty('--' + themePrefix + 'btn-disabled-border-color', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-color', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-border-color', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-hover-bg', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-hover-border-color', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-active-bg', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-active-border-color', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-disabled-color', colorValue)
          styleRules[colorPicker.id + 'OutlineBtn'].style.setProperty('--' + themePrefix + 'btn-disabled-border-color', colorValue)

          updateStylesPreview()
        }
      })
    })


    // Direction (LTR/RTL) control
    const rtlSwitch = document.getElementById('rtl-switch')
    rtlSwitch.checked = currentDirection === 'rtl'
    rtlSwitch.addEventListener('change', () => {
      window.location.reload()
      if (rtlSwitch.checked) {
        setToStorage('direction', 'rtl')
      } else {
        setToStorage('direction', 'ltr')
      }
    })


    // Bind slider and number input controls within "slider-input" containers
    const sliderInputs = document.querySelectorAll('.slider-input')
    sliderInputs.forEach(container => {
      const rangeInput = container.querySelector('input[type="range"]')
      const numberInput = container.querySelector('input[type="number"]')
      rangeInput.addEventListener('input', function() {
        numberInput.value = rangeInput.value;
      })
      numberInput.addEventListener('input', function() {
        rangeInput.value = numberInput.value;
      })
    })


    // Border width control
    const borderWidthInput = document.getElementById('border-width')
    const borderWidthStoredValue = getFromStorage('theme-border-width')
    borderWidthInput.value = borderWidthStoredValue !== null ? parseInt(borderWidthStoredValue) : borderWidthInput.value
    borderWidthInput.parentElement.querySelector('input[type="range"]').value = borderWidthStoredValue !== null ? parseInt(borderWidthStoredValue) : borderWidthInput.value

    borderWidthInput.parentElement.addEventListener('input', (e) => {
      const borderWidth = e.target.value
      setToStorage('theme-border-width', borderWidth + 'px')
      styleRules.root.style.setProperty(
        '--' + themePrefix + 'border-width',
        borderWidth + 'px'
      )
      updateStylesPreview()
    })


    // Rounding (border radius) control
    const borderRadiusInput = document.getElementById('border-radius')
    const borderRadiusStoredValue = getFromStorage('theme-border-radius')
    borderRadiusInput.value = borderRadiusStoredValue !== null ? parseFloat(borderRadiusStoredValue) : borderRadiusInput.value
    borderRadiusInput.parentElement.querySelector('input[type="range"]').value = borderRadiusStoredValue !== null ? parseFloat(borderRadiusStoredValue) : borderRadiusInput.value

    borderRadiusInput.parentElement.addEventListener('input', (e) => {
      const borderRadius = e.target.value
      setToStorage('theme-border-radius', borderRadius + 'rem')
      styleRules.root.style.setProperty(
        '--' + themePrefix + 'border-radius',
        borderRadius + 'rem'
      )
      updateStylesPreview()
    })


    // Show action buttons when any setting is changed
    const customizer = document.getElementById('customizer')
    const actionBtns = document.getElementById('customizer-btns')

    if (getFromStorage('theme-customizer-btns')) {
      actionBtns.classList.remove('d-none')
    }

    customizer.addEventListener('change', (e) => {
      if (e.target !== rtlSwitch) {
        setToStorage('theme-customizer-btns', true)
        actionBtns.classList.remove('d-none')
      }
    })


    // Reset settings
    const resetBtn = document.getElementById('customizer-reset')
    resetBtn.addEventListener('click', () => {
      let storageKeys = []
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).substring(0, 6) == 'theme-') {
          storageKeys.push(localStorage.key(i))
        }
      }
      for (let i = 0; i < storageKeys.length; i++) {
        localStorage.removeItem(storageKeys[i])
        localStorage.removeItem('direction')
      }
      window.location.reload()
    })

  })

})()