// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const window = vscode.window;
const tracerun = require('tracerun-cli');
const moment = require('moment');

let ready = false;
let preparing = false;
let statusBar;
let cli = new tracerun.client.Client();
let chan = window.createOutputChannel("TraceRun");

tracerun.client.setErrFunc(err => {
  console.error(err);
});

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
exports.activate = function (context) {
  statusBar = window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBar.show();

  addDocument(window.activeTextEditor.document);

  // search for slots
  context.subscriptions.push(getSearchSlotsCommand());

  // search for targets
  context.subscriptions.push(getSearchTargetCommand());

  window.onDidChangeActiveTextEditor(e => {
    addDocument(e.document);
  });

  window.onDidChangeTextEditorSelection(e => {
    addDocument(e.textEditor.document);
  });
};

// this method is called when your extension is deactivated
exports.deactivate = function () {
};

function getSearchSlotsCommand() {
  return vscode.commands.registerCommand('extension.tracerun.slots', function () {
    let targetOptions = {
      placeHolder: 'target to search',
      value: "",
      ignoreFocusOut: true
    };
    window.showInputBox(targetOptions).then(function (target) {
      if (!target || target.length === 0) {
        window.showWarningMessage("target incorrect.");
      } else {
        let rangeOptions = {
          prompt: '"2000-01-02 03:04:56 to 2011-02-03 04:30:05"',
          placeHolder: 'Please use this format',
          value: "",
          ignoreFocusOut: true
        };
        window.showInputBox(rangeOptions).then(function (val) {
          let arr = val.split("to");
          if (arr.length != 2) {
            window.showWarningMessage("Date range incorrect.");
          } else {
            let start = moment(arr[0]);
            if (!start.isValid()) {
              window.showWarningMessage("Date range incorrect.");
              return;
            }

            let end = moment(arr[1]);
            if (!end.isValid()) {
              window.showWarningMessage("Date range incorrect.");
              return;
            }

            cli.getSlots(target, start.unix(), end.unix(), slots => {
              chan.clear();
              chan.appendLine("slots: " + "(target: " + target + ")");
              let all = slots.slotsList;
              for (var i = 0; i < all.length; i++) {
                chan.appendLine(all[i].start + ": " + all[i].slot);
              }
              chan.show();
            });
          }
        });
      }
    });
  });
}

function getSearchTargetCommand() {
  return vscode.commands.registerCommand('extension.tracerun.targets', function () {
    chan.clear();
    chan.appendLine("targets:");
    cli.getTargets(list => {
      let targets = list.targetList;
      for (var i = 0; i < targets.length; i++) {
        chan.appendLine((i + 1) + ": " + targets[i]);
      }
      chan.show();
    });
  });
}

function prepareTraceRun() {
  statusBar.text = "$(clock) TraceRun preparing";
  preparing = true;

  tracerun.agent.start(err => {
    if (err) {
      console.error(err);
    } else {
      ready = true;
      statusBar.text = "$(clock) TraceRun Active";
    }
    preparing = false;
  });
}

function addDocument(doc) {
  if (!ready && !preparing) {
    prepareTraceRun();
  } else if (ready && !preparing) {
    if (doc.uri.scheme === "file") {
      cli.addAction(doc.fileName);
    }
  }
}
