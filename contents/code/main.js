// const dualScreens = workspace.screens.length > 1 ? true : false;

let debugEnabled = readConfig('debug_enabled', false)
let allConfig = []


function compareWindowName(window, windowName) {
  return window.resourceClass.includes(windowName) || window.resourceName.includes(windowName)
}

function searchWindow(target, indexWindow) {
  debug('Search window '+target + ' (index '+indexWindow+')')
  let nWindow = 1
  const windows = workspace.windowList();
  for (var i = 0; i < windows.length; i++) {
    if (compareWindowName(windows[i], target)) {
      if (nWindow === indexWindow) {
        return windows[i];
      }
      nWindow += 1
    }
  }
  return false;
}

function searchDesktop(desktop) {
  const desktops = workspace.desktops
  for (var i = 0; i < desktops.length; i++) {
    if (desktops[i].name.includes(String(desktop))) {
      return desktops[i]
    }
  }
  return false;
}

function moveWindowToScreen(window, screen) {
  workspace.sendClientToScreen(window, workspace.screens[screen-1])
}

function maximizeWindow(window) {
  window.setMaximize(true, true)
}

function minimizeWindow(window) {
  window.minimized = true
}

function moveWindowToDesktop(window, desktop) {
  if (desktop === 'all') {
    window.desktops = []
  } else {
    targetDesktop = searchDesktop(desktop)
    if (targetDesktop !== false) {
      window.desktops = [ targetDesktop ]
    } else {
      debug("Desktop containing string '"+desktop+"' not found")
    }
  }
} 

function moveWindowToPosition(window, x, y) {
  window.tile = null
  window.minimized = false
  let q = Object.assign({}, window.frameGeometry)
  debug("Move window from: "+q.x+"x"+q.y + " to "+x+"x"+y)
  q.x = x
  q.y = y
  window.frameGeometry = q
}

function resizeWindow(window, width, height) {
  window.tile = null
  window.minimized = false
  let q = Object.assign({}, window.frameGeometry)
  if (width !== null) {
    q.width = width 
  }
  if (height !== null) {
    q.height = height
  }
  window.frameGeometry = q
}

function tileWindow(window) {
  let tileManager = workspace.tilingForScreen(window.output)
  let bestTile = tileManager.bestTileForPosition(window.x, window.y)
  window.tile = bestTile
}

function debugWindow(window, action) {
  if (debugEnabled) {
    print(window.resourceClass + ' - ' + action)
  }
}


function debug(action) {
  if (debugEnabled) {
    print(action)
  }
}


function execRule(rule, indexWindow) {

  let win = searchWindow(rule.name, indexWindow)

  if (win !== false) {
    if ('screen' in rule) {        
      debugWindow(win, 'Move to screen '+rule.screen)
      moveWindowToScreen(win, rule.screen)
    }
    if ('desktop' in rule) {
      debugWindow(win, 'Move to desktop '+rule.desktop)
      moveWindowToDesktop(win, rule.desktop)
    }
    if ('maximized' in rule) {
      if (rule.maximized) {
        debugWindow(win, 'Maximize window')
        maximizeWindow(win)
      }
    }
    if ('position' in rule) {
      debugWindow(win, 'Move window to position '+rule.position.x+'x'+rule.position.y)
      moveWindowToPosition(win, rule.position.x, rule.position.y)
    }

    if ('size' in rule) {
      debugWindow(win, 'Reisze window to '+rule.size.width+'x'+rule.size.height)
      resizeWindow(win, rule.size.height, rule.size.width)
    }

    if ('tiled' in rule) {
      if (rule.tiled) {
        debugWindow(win, 'Tile the window as its current position')
        tileWindow(win)
      }
    }
    if ('minimized' in rule) {
      if (rule.minimized) {
        debugWindow(win, 'Minimize the window')
        minimizeWindow(win)
      }
    }
  } else {
    debug("Window "+rule.name + " not found")
  }
}

function isMonitorConnected(name) {
  for (var i=0; i<workspace.screens.length; i++) {
    let screen = workspace.screens[i]
    let screenName = screen.name+' '+screen.manufacturer + ' ' + screen.model
    if (screenName.includes(name)) {
      return true
    }
  }
  return false
}


function execRules(config) {
  for (var i = 0; i < config.rules.length; i++) {
    execRule(config.rules[i], config.rules[i].index)
  }
}

function onShortcut(config) {

  debug("Received keybinding "+config.keybinding)
  execRules(config)
}


function onScreensChanged() {
  debug('Configuration of monitors changed')

  let configApplied = false

  for (var i = 0; i < allConfig.length; i++) {
    if (allConfig[i].triggerNmonitors) {
      let nScreens = workspace.screens.length
      if (nScreens === parseInt(allConfig[i].nMonitors)) {
        debug(nScreens+' monitors detected: applying configuration '+String(i+1))
        execRules(allConfig[i])
        configApplied = true
      }
    }

    if (allConfig[i].triggerMonitorName && (! configApplied)) {
      if (isMonitorConnected(allConfig[i].monitorName)) {
        debug('Monitor '+allConfig[i].monitorName +' detected: applying configuration '+String(i+1))
        execRules(allConfig[i])
      }
    }
  }
}

function parseRules(configurationIndex, ruleStr) {
  let rules = ruleStr.split("\n");
  let parsedRules = [];
  let windowCounters = {}
  for (var i = 0; i < rules.length; i++) {
    let sections = rules[i].split(",");
    if (sections.length < 2) {
      print("Error on parsing rules for configuration "+configurationIndex+" on line "+rules[i])
      return false;
    }
    try {
      if (! (sections[0].trim() in windowCounters)) {
        windowCounters[sections[0].trim()] = 1
      } 
      parsedRule = {name: sections[0].trim(), index: windowCounters[sections[0].trim()]}
      windowCounters[sections[0].trim()] += 1
      
      for (var j = 1; j<sections.length; j++) {
        if (sections[j].includes('screen=')) {
          parsedRule.screen = parseInt(sections[j].split('=')[1].trim())
        }
        else if (sections[j].includes('maximized=')) {
          let value = sections[j].split('=')[1].trim()
          parsedRule.maximized = value === 'true' ? true : false; 
        }
        else if (sections[j].trim() === 'maximized') {
          parsedRule.maximized = true
        }
        else if (sections[j].includes('desktop=')) {
          let value = sections[j].split('=')[1].trim()
          parsedRule.desktop = value
        }
        else if (sections[j].includes('position=')) {
          let value = sections[j].split('=')[1].trim()
          let coordinates = value.split('x')
          parsedRule.position = { x: coordinates[0], y: coordinates[1]}
        }

        else if (sections[j].includes('size=')) {
          let value = sections[j].split('=')[1].trim()
          let sizes = value.split('x')
          parsedRule.size = { width: sizes[1], height: sizes[0]}
          parsedRule.size.width = parsedRule.size.width === '' ? null : parsedRule.size.width
          parsedRule.size.height = parsedRule.size.height === '' ? null : parsedRule.size.height
        }

        else if (sections[j].includes('tiled=')) {
          let value = sections[j].split('=')[1].trim()
          parsedRule.tiled = value === 'true' ? true : false; 
        }
        else if (sections[j].trim() === 'tiled') {
          parsedRule.tiled = true
        } 

        else if (sections[j].includes('minimized=')) {

          let value = sections[j].split('=')[1].trim()
          parsedRule.minimized = value === 'true' ? true : false; 
        }
        else if (sections[j].trim() === 'minimized') {
          parsedRule.minimized = true
        } else {
          print("Error: invalid rule for configuration "+configurationIndex+": "+rules[i])
        }
      }
      parsedRules.push(parsedRule)
    } catch (error) {
      print("Error on parsing rules for configuration "+configurationIndex+" on line "+rules[i] + ': ' +error)
      return false
    }
  }
  return parsedRules
}

function parseConfig() {
  let config = []
  for (var i = 1; i<=6; i++) {
    let triggerKeybinding = readConfig('conf'+i+'_trigger_keybinding', false);
    let keybinding = readConfig('conf'+i+'_keybinding', "");

    let triggerNmonitors = readConfig('conf'+i+'_trigger_nmonitors', false);
    let nMonitors = readConfig('conf'+i+'_nmonitors', ''); 

    let triggerMonitorName = readConfig('conf'+i+'_trigger_monitor_name', '');
    let monitorName = readConfig('conf'+i+'_monitor_name', ''); 

    let rules = readConfig('conf'+i+'_rules', "");
    
    if (triggerKeybinding && (keybinding === '')) {
        print("Error on configuration "+i+": Trigger by keybinding is enabled without keybinding")
        return null
    }
    if (triggerNmonitors && (nMonitors === '')) {
        print("Error on configuration "+i+": Trigger by # monitors is enabled without specified # of monitors")
        return null
    }
    if (triggerMonitorName && (monitorName === '')) {
        print("Error on configuration "+i+": Trigger by monitor's name is enabled without specified monitor name")
        return null
    }
    if (triggerKeybinding || triggerNmonitors || triggerMonitorName) {
      if (rules !== '') {
        let parsedRules = parseRules(i, rules)
        if (parsedRules === false) {
          print("Error on parsing rules for configuration "+i)
          return null
        }
        config.push({ triggerKeybinding, triggerNmonitors, triggerMonitorName, keybinding, nMonitors, monitorName, rules: parsedRules})
      }
    }
  }
  return config
}


function main() {
  debug("Starting KWin Multiconf script")

  allConfig = parseConfig()
  if (allConfig === null) {
    debug("No active configuration found")
    return
  } 
  debug("Configuration parsed successfully")

  let shouldListenScreens = false
  for (var i = 0; i < allConfig.length; i++) {
    if (allConfig[i].triggerKeybinding) {
      debug("Registering keybinding "+allConfig[i].keybinding+" for configuration "+String(i+1))
      registerShortcut('KWin Multiconf: config '+String(i+1), 'KWin Multiconf: config '+String(i+1), allConfig[i].keybinding, function (action) {
        let index = parseInt(action.text.match(/\d/g)[0]) - 1
        onShortcut(allConfig[index])
      });
    }

    if (allConfig[i].triggerMonitorName || allConfig[i].triggerNmonitors) {
      shouldListenScreens = true
    }
  }

  if (shouldListenScreens) {
    debug('Setting listener to detect change of monitors')
    workspace.screensChanged.connect(function() {
      onScreensChanged()
    });
  }
}

main()