figma.showUI(__html__, { width: 420, height: 600 });

/* ================= STATE ================= */

var PAGE_BUFFER = [];
var RENDERED = {};
var NODE_MAP = {};
var REVERSE_MAP = {};

/* ================= HELPERS ================= */

function registerNode(id, node){
    NODE_MAP[id] = node;
    REVERSE_MAP[node.id] = id;
}

/* ================= RENDER ================= */

async function renderPage(page){

    if(RENDERED[page.index]) return; // tránh duplicate
    RENDERED[page.index] = true;

    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    const frame = figma.createFrame();
    frame.name = "Page " + page.index;

    frame.resize(page.width || 1200, page.height || 800);
    frame.layoutMode = "NONE";

    for(let i=0; i<page.textItems.length; i++){

        const t = page.textItems[i];

        if(!t.text || !t.text.trim()) continue;

        const node = figma.createText();
        node.characters = t.text;

        node.x = t.x;
        node.y = t.y;

        registerNode(t.id, node);

        frame.appendChild(node);
    }

    figma.currentPage.appendChild(frame);
}

/* ================= BATCH ================= */

async function renderBatch(pages){

    for(let i=0; i<pages.length; i++){

        await renderPage(pages[i]);

        // 🔥 tránh block UI
        await new Promise(function(r){ setTimeout(r,5); });
    }
}

/* ================= HIGHLIGHT ================= */

function highlight(id){

    var node = NODE_MAP[id];
    if(!node) return;

    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
}

/* ================= SELECTION SYNC ================= */

figma.on("selectionchange", function(){

    const sel = figma.currentPage.selection[0];
    if(!sel) return;

    const id = REVERSE_MAP[sel.id];
    if(!id) return;

    figma.ui.postMessage({
        type:"select-sync",
        id:id,
        code:'<p>'+ (sel.characters || "") +'</p>'
    });
});

/* ================= ENTRY ================= */

figma.ui.onmessage = async function(msg){

    if(msg.type === "page-chunk"){

        const page = msg.page;

        if(RENDERED[page.index]) return;

        PAGE_BUFFER.push(page);

        // 🔥 render theo batch 2 page
        if(PAGE_BUFFER.length >= 2){
            await renderBatch(PAGE_BUFFER);
            PAGE_BUFFER = [];
        }
    }

    if(msg.type === "done-stream"){

        if(PAGE_BUFFER.length){
            await renderBatch(PAGE_BUFFER);
            PAGE_BUFFER = [];
        }

        figma.notify("✅ Import complete");
    }

    if(msg.type === "highlight"){
        highlight(msg.id);
    }
};