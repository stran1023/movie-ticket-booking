document.addEventListener("DOMContentLoaded", function () {
    const textarea = document.getElementById("id_seat_map");
    const grid = document.getElementById("seat-grid");
    
    if (!textarea || !grid) return;

    let tool = "seat";
    let seatType = "normal";
    let width = 10;
    let height = 8;
    let map = [];
    let selectionStart = null;

    // Create message container
    const messageContainer = document.createElement("div");
    messageContainer.id = "editor-message";
    messageContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 9999;
        display: none;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(messageContainer);

    // Load existing map
    try {
        const savedData = JSON.parse(textarea.value || "[]");
        
        // Check if saved data is in flat format (for preview) or map format
        if (savedData.length > 0) {
            // If first item has x,y coordinates, it's the map format
            if (savedData[0].x !== undefined) {
                map = savedData;
            } else {
                // It's in flat format - convert to map format for editing
                map = convertFlatToMap(savedData);
            }
            
            // Convert any existing aisles to empty
            map = map.map(tile => {
                if (tile.kind === "aisle") {
                    return { ...tile, kind: "empty" };
                }
                return tile;
            });
            
            // Calculate dimensions from map
            const maxX = Math.max(...map.map(t => t.x || 0));
            const maxY = Math.max(...map.map(t => t.y || 0));
            width = Math.max(width, maxX);
            height = Math.max(height, maxY);
        } else {
            createDefaultMap();
        }
    } catch (e) {
        console.warn("Failed to parse seat map, creating default");
        createDefaultMap();
    }

    // Convert flat format to map format for editing
    function convertFlatToMap(flatList) {
        const map = [];
        const rows = {};
        
        // Group by row
        flatList.forEach(seat => {
            if (!rows[seat.row]) rows[seat.row] = [];
            rows[seat.row].push(seat);
        });
        
        // Sort rows alphabetically
        const sortedRows = Object.keys(rows).sort();
        
        sortedRows.forEach((rowLetter, rowIndex) => {
            const seats = rows[rowLetter].sort((a, b) => a.number - b.number);
            const y = rowIndex + 1;
            let x = 1;
            
            seats.forEach(seat => {
                if (seat.type === "couple") {
                    // For couple seats, we need to pair them
                    // Check if this is the first of a pair (odd numbers)
                    if (seat.number % 2 === 1) {
                        map.push({
                            x: x,
                            y: y,
                            kind: "seat",
                            type: "couple",
                            row: rowLetter,
                            number: seat.number,
                            endNumber: seat.number + 1
                        });
                        x += 2; // Skip the next x position
                    }
                    // Skip even numbers as they're handled by the left tile
                } else {
                    map.push({
                        x: x,
                        y: y,
                        kind: "seat",
                        type: seat.type,
                        row: rowLetter,
                        number: seat.number
                    });
                    x++;
                }
            });
            
            // Fill remaining columns with empty tiles
            while (x <= width) {
                map.push({
                    x: x,
                    y: y,
                    kind: "empty"
                });
                x++;
            }
        });
        
        return map;
    }

    function createDefaultMap() {
        map = [];
        for (let y = 1; y <= height; y++) {
            for (let x = 1; x <= width; x++) {
                map.push({
                    x: x,
                    y: y,
                    kind: "empty"
                });
            }
        }
    }

    function validateMap() {
        // First, convert any remaining aisles to empty
        map = map.map(tile => {
            if (tile.kind === "aisle") {
                return { ...tile, kind: "empty" };
            }
            return tile;
        });
        
        // Identify all couple seats and remove any tiles at x+1 positions
        const coupleSeats = map.filter(t => t.kind === "seat" && t.type === "couple");
        const positionsToRemove = new Set();
        
        // Mark positions that should be removed (the right half of couple seats)
        coupleSeats.forEach(couple => {
            positionsToRemove.add(`${couple.x + 1},${couple.y}`);
        });
        
        // Filter out any tiles at marked positions
        map = map.filter(tile => {
            const key = `${tile.x},${tile.y}`;
            return !positionsToRemove.has(key);
        });
        
        // Now ensure all tiles have required properties and no duplicates
        const validMap = [];
        const processedPositions = new Set();
        
        // Sort by position
        const sortedMap = [...map].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        
        for (const tile of sortedMap) {
            const key = `${tile.x},${tile.y}`;
            
            // Skip if we've already processed this position
            if (processedPositions.has(key)) continue;
            
            // Clean the tile data
            const cleanTile = {
                x: tile.x,
                y: tile.y,
                kind: tile.kind || "empty"
            };
            
            if (tile.kind === "seat") {
                cleanTile.type = tile.type || "normal";
                if (tile.row) cleanTile.row = tile.row;
                if (tile.number) cleanTile.number = tile.number;
                if (tile.endNumber) cleanTile.endNumber = tile.endNumber;
            }
            
            validMap.push(cleanTile);
            processedPositions.add(key);
        }
        
        map = validMap;
    }

    // Helper function to check if a row has couple seats
    function rowHasCoupleSeats(y) {
        return map.some(t => t.kind === "seat" && t.type === "couple" && t.y === y);
    }

    // Helper function to check if a row has normal/VIP seats
    function rowHasNormalOrVipSeats(y) {
        return map.some(t => t.kind === "seat" && (t.type === "normal" || t.type === "vip") && t.y === y);
    }

    // Helper function to check if a row has mixed seat types
    function rowHasMixedSeatTypes(y) {
        const hasCouple = rowHasCoupleSeats(y);
        const hasNormal = rowHasNormalOrVipSeats(y);
        return hasCouple && hasNormal;
    }

    // Helper function to get row type
    function getRowType(y) {
        if (rowHasCoupleSeats(y)) return "couple";
        if (rowHasNormalOrVipSeats(y)) return "regular";
        return "empty";
    }

    // Helper function to check if a row is completely empty
    function isRowEmpty(y) {
        return !map.some(t => t.kind === "seat" && t.y === y);
    }

    // NEW: Validate dimension constraints
    function validateDimensions() {
        if (width < 10) {
            showMessage("Cannot save: Minimum width is 10 columns.", "error");
            return false;
        }
        if (height < 8) {
            showMessage("Cannot save: Minimum height is 8 rows.", "error");
            return false;
        }
        return true;
    }

    // Validate entire map for save (empties, empty rows, mixed types, dimensions, total seats)
    function validateForSave() {
        // Check dimensions first
        if (!validateDimensions()) {
            return false;
        }
        
        // Check total seats limit
        const totalSeats = calculateTotalSeats();
        if (totalSeats > 200) {
            showMessage(`Cannot save: Total seats (${totalSeats}) exceeds maximum limit of 200.`, "error");
            return false;
        }
        
        // Check for empty tiles
        const hasEmpties = map.some(tile => tile.kind === "empty");
        if (hasEmpties) {
            showMessage("Cannot save: There are empty seats in the layout. Please fill all cells.", "error");
            return false;
        }
        
        // Check for empty rows
        const emptyRows = [];
        for (let y = 1; y <= height; y++) {
            if (isRowEmpty(y)) {
                emptyRows.push(y);
            }
        }
        
        if (emptyRows.length > 0) {
            const rowLetters = emptyRows.map(y => String.fromCharCode(64 + parseInt(y))).join(', ');
            showMessage(`Cannot save: Row(s) ${rowLetters} are empty.`, "error");
            return false;
        }
        
        // Check for mixed rows (couple with normal/vip)
        const rowsWithIssues = new Set();
        
        for (let y = 1; y <= height; y++) {
            if (rowHasMixedSeatTypes(y)) {
                rowsWithIssues.add(y);
            }
        }
        
        if (rowsWithIssues.size > 0) {
            const rowLetters = Array.from(rowsWithIssues)
                .map(y => String.fromCharCode(64 + parseInt(y)))
                .join(', ');
            showMessage(`Cannot save: Row(s) ${rowLetters} mix couple seats with normal/VIP seats`, "error");
            return false;
        }
        
        return true;
    }

    function render() {
        validateMap();
        
        // Update grid template columns
        grid.style.gridTemplateColumns = `repeat(${width}, minmax(40px, auto))`;
        grid.innerHTML = "";

        // Create a map for quick lookup
        const tileMap = new Map();
        map.forEach(tile => {
            tileMap.set(`${tile.x},${tile.y}`, tile);
        });

        // Render row by row
        for (let y = 1; y <= height; y++) {
            const rowType = getRowType(y);
            
            for (let x = 1; x <= width; x++) {
                const key = `${x},${y}`;
                let tile = tileMap.get(key);
                
                // Skip if this position should be empty due to a couple seat at x-1
                const leftTile = tileMap.get(`${x - 1},${y}`);
                if (leftTile && leftTile.kind === "seat" && leftTile.type === "couple") {
                    continue; // Don't render anything at this position
                }
                
                if (!tile) {
                    // Create empty tile only if not part of a couple seat
                    tile = { x, y, kind: "empty" };
                    map.push(tile);
                    tileMap.set(key, tile);
                }
                
                const div = createTileElement(tile, rowType);
                grid.appendChild(div);
            }
        }

        updateSeatCounter();
    }

    function createTileElement(tile, rowType) {
        const div = document.createElement("div");
        div.className = "cell";
        
        if (tile.kind === "seat") {
            div.classList.add(`seat-${tile.type || "normal"}`);
            
            if (tile.type === "couple") {
                div.style.gridColumn = `span 2`;
                if (tile.row && tile.number && tile.endNumber) {
                    div.textContent = `${tile.row}${tile.number}-${tile.row}${tile.endNumber}`;
                    div.title = `Couple Seat ${tile.row}${tile.number}-${tile.row}${tile.endNumber}`;
                } else if (tile.row && tile.number) {
                    div.textContent = `${tile.row}${tile.number}-${tile.row}${tile.number + 1}`;
                    div.title = `Couple Seat ${tile.row}${tile.number}-${tile.row}${tile.number + 1}`;
                }
            } else {
                if (tile.row && tile.number) {
                    div.textContent = `${tile.row}${tile.number}`;
                    div.title = `Seat ${tile.row}${tile.number}`;
                }
            }
        } else {
            div.classList.add("empty");
            
            // Only show restriction message when trying to add normal/vip seats
            if (rowType === "couple" && tool === "seat" && (seatType === "normal" || seatType === "vip")) {
                div.title = "This row has couple seats - only couple seats allowed";
                div.textContent = "🚫";
                div.style.opacity = "0.5";
            } 
            else if (rowType === "regular" && tool === "seat" && seatType === "couple") {
                div.title = "This row has normal/vip seats - only normal/vip seats allowed";
                div.textContent = "🚫";
                div.style.opacity = "0.5";
            }
            else {
                div.title = "Empty space (click to add seat)";
                div.textContent = "➕";
            }
        }

        div.dataset.x = tile.x;
        div.dataset.y = tile.y;
        div.dataset.kind = tile.kind;

        div.onclick = (e) => {
            e.preventDefault();
            
            // Handle row tool
            if (tool === "row") {
                handleRowTool(tile);
            } else if (tool === "seat" && seatType === "couple") {
                handleCoupleSeatCreation(tile);
            } else {
                handleSingleTileEdit(tile);
            }
        };

        return div;
    }

    // Handle row tool click
    function handleRowTool(tile) {
        const y = tile.y;
        const rowLetter = String.fromCharCode(64 + y);
        
        // Check total seats limit before making changes
        const currentTotal = calculateTotalSeats();
        let newTotal = currentTotal;
        
        // Remove all tiles in this row
        const rowSeats = map.filter(t => t.y === y && t.kind === "seat");
        rowSeats.forEach(seat => {
            newTotal -= (seat.type === "couple" ? 2 : 1);
        });
        
        // If trying to set row to couple seats
        if (seatType === "couple") {
            // Check if width is odd
            if (width % 2 !== 0) {
                showMessage(`Cannot set Row ${rowLetter} to couple seats: row width is odd.`, "error");
                return;
            }
            
            // Calculate new seats count
            const coupleCount = Math.floor(width / 2);
            newTotal += coupleCount * 2;
            
            // Check limit
            if (newTotal > 200) {
                showMessage(`Cannot set row: Would exceed maximum limit of 200 seats.`, "error");
                return;
            }
            
            // Remove all tiles in this row
            map = map.filter(t => t.y !== y);
            
            // Add couple seats at odd x positions
            for (let x = 1; x <= width; x += 2) {
                map.push({
                    x: x,
                    y: y,
                    kind: "seat",
                    type: "couple"
                });
            }
            
            showMessage(`Row ${rowLetter} set to couple seats`);
        } 
        // If setting row to normal or VIP seats
        else if (seatType === "normal" || seatType === "vip") {
            // Calculate new seats count
            newTotal += width;
            
            // Check limit
            if (newTotal > 200) {
                showMessage(`Cannot set row: Would exceed maximum limit of 200 seats.`, "error");
                return;
            }
            
            // Remove all tiles in this row
            map = map.filter(t => t.y !== y);
            
            // Add single seats at all x positions
            for (let x = 1; x <= width; x++) {
                map.push({
                    x: x,
                    y: y,
                    kind: "seat",
                    type: seatType
                });
            }
            
            showMessage(`Row ${rowLetter} set to ${seatType} seats`);
        }
        
        autoNumber();
        render();
    }

    function showMessage(text, type = "info") {
        messageContainer.style.display = "block";
        messageContainer.style.backgroundColor = type === "error" ? "#dc3545" : "#28a745";
        messageContainer.textContent = text;

        // Hide after 3 seconds
        setTimeout(() => {
            messageContainer.style.animation = "slideOut 0.3s ease";
            setTimeout(() => {
                messageContainer.style.display = "none";
                messageContainer.style.animation = "slideIn 0.3s ease";
            }, 300);
        }, 3000);
    }

    function handleCoupleSeatCreation(tile) {
        const rowType = getRowType(tile.y);
        
        // Check total seats limit
        const currentTotal = calculateTotalSeats();
        if (currentTotal + 2 > 200) {
            showMessage("Cannot create couple seat: Would exceed maximum limit of 200 seats.", "error");
            selectionStart = null;
            return;
        }
        
        // Can't create couple seat on existing couple seat
        if (tile.kind === "seat" && tile.type === "couple") {
            showMessage("Cannot modify couple seat directly", "error");
            selectionStart = null;
            return;
        }

        // If row has normal/VIP seats, can't add couple seats
        if (rowType === "regular") {
            showMessage("Cannot add couple seats to a row with normal or VIP seats", "error");
            selectionStart = null;
            return;
        }

        if (!selectionStart) {
            // First selection
            selectionStart = { x: tile.x, y: tile.y };
            showMessage("Now click on the seat to the right");
            return;
        }

        // Check if this is a valid couple seat pair
        const isValid = (selectionStart.y === tile.y && 
                        tile.x === selectionStart.x + 1 &&
                        tile.x <= width);

        if (isValid) {
            // Remove both positions and any empty tiles at those positions
            map = map.filter(t => !(t.y === tile.y && 
                                   (t.x === selectionStart.x || t.x === selectionStart.x + 1)));
            
            // Add single couple seat at left position
            map.push({
                x: selectionStart.x,
                y: tile.y,
                kind: "seat",
                type: "couple"
            });

            selectionStart = null;
            autoNumber();
            render();
            showMessage("Couple seat created");
        } else {
            selectionStart = null;
            showMessage("Please select the seat directly to the right", "error");
        }
    }

    function handleSingleTileEdit(tile) {
        selectionStart = null;
        const rowType = getRowType(tile.y);

        // Handle couple seat erasure specially
        if (tile.kind === "seat" && tile.type === "couple" && tool === "erase") {
            const x = tile.x;
            const y = tile.y;
            
            // Remove the couple seat
            map = map.filter(t => !(t.x === x && t.y === y));
            
            // Add two empty spaces (not normal seats)
            map.push({ x: x, y: y, kind: "empty" });
            map.push({ x: x + 1, y: y, kind: "empty" });
            
            autoNumber();
            render();
            showMessage("Couple seat removed");
            return;
        }

        // Prevent modifying couple seats with other tools
        if (tile.kind === "seat" && tile.type === "couple") {
            showMessage("Use Erase tool to remove couple seat first", "error");
            return;
        }

        // Check row type consistency for adding normal/VIP seats
        if (tool === "seat" && (seatType === "normal" || seatType === "vip")) {
            if (rowType === "couple") {
                showMessage("Cannot add normal or VIP seats to a row with couple seats", "error");
                return;
            }
        }

        // Check total seats limit when adding a seat
        if (tool === "seat") {
            const currentTotal = calculateTotalSeats();
            const seatValue = (seatType === "couple" ? 2 : 1);
            
            // If replacing an empty seat
            if (tile.kind === "empty") {
                if (currentTotal + seatValue > 200) {
                    showMessage(`Cannot add seat: Would exceed maximum limit of 200 seats.`, "error");
                    return;
                }
            }
            // If changing an existing seat type
            else if (tile.kind === "seat") {
                const oldValue = (tile.type === "couple" ? 2 : 1);
                const newTotal = currentTotal - oldValue + seatValue;
                if (newTotal > 200) {
                    showMessage(`Cannot change seat: Would exceed maximum limit of 200 seats.`, "error");
                    return;
                }
            }
        }

        switch (tool) {
            case "seat":
                tile.kind = "seat";
                tile.type = seatType;
                break;
            case "erase":
                tile.kind = "empty";
                delete tile.type;
                delete tile.row;
                delete tile.number;
                delete tile.endNumber;
                break;
        }

        autoNumber();
        render();
    }

    function autoNumber() {
        const rows = {};

        // Group seats by row
        map.forEach(tile => {
            if (tile.kind === "seat" && tile.y) {
                if (!rows[tile.y]) rows[tile.y] = [];
                rows[tile.y].push(tile);
            }
        });

        // Sort and number seats in each row
        Object.keys(rows).sort((a, b) => parseInt(a) - parseInt(b)).forEach((y, rowIndex) => {
            const rowSeats = rows[y].sort((a, b) => a.x - b.x);
            const rowLabel = String.fromCharCode(65 + rowIndex);

            let seatNumber = 1;
            for (let i = 0; i < rowSeats.length; i++) {
                const seat = rowSeats[i];
                
                if (seat.type === "couple") {
                    seat.row = rowLabel;
                    seat.number = seatNumber;
                    seat.endNumber = seatNumber + 1;
                    seatNumber += 2;
                } else {
                    seat.row = rowLabel;
                    seat.number = seatNumber;
                    seatNumber++;
                }
            }
        });
    }

    // Calculate total seats (couple counts as 2)
    function calculateTotalSeats() {
        let total = 0;
        map.forEach(tile => {
            if (tile.kind === "seat") {
                total += (tile.type === "couple" ? 2 : 1);
            }
        });
        return total;
    }

    // Export to flat list format (for database and preview)
    function exportToFlatList() {
        const exportList = [];
        
        // Get all seats, sorted by row and x position
        const seats = map.filter(t => t.kind === "seat")
            .sort((a, b) => (a.y - b.y) || (a.x - b.x));
        
        seats.forEach(seat => {
            if (seat.type === "couple") {
                // Export two entries for couple seats
                exportList.push({
                    row: seat.row,
                    type: seat.type,
                    number: seat.number,
                    status: "available"
                });
                exportList.push({
                    row: seat.row,
                    type: seat.type,
                    number: seat.number + 1,
                    status: "available"
                });
            } else {
                // Export single entry for normal/vip seats
                exportList.push({
                    row: seat.row,
                    type: seat.type,
                    number: seat.number,
                    status: "available"
                });
            }
        });
        
        return exportList;
    }

    function updateSeatCounter() {
        const seatCount = calculateTotalSeats();
        
        const counter = document.getElementById("seat-counter");
        if (counter) {
            counter.innerHTML = `Total seats: ${seatCount} / 200 max`;
            
            // Change color if near limit
            if (seatCount >= 200) {
                counter.style.color = "#dc3545";
                counter.style.fontWeight = "bold";
            } else if (seatCount >= 180) {
                counter.style.color = "#ffc107";
                counter.style.fontWeight = "bold";
            } else {
                counter.style.color = "";
                counter.style.fontWeight = "";
            }

            const totalSeatsField = document.getElementById("id_total_seats");
            if (totalSeatsField) {
                totalSeatsField.value = seatCount;
                totalSeatsField.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    function save() {
        // Validate for mixed rows before saving
        if (!validateForSave()) {
            return false;
        }

        // Clean map before saving - remove any empty tiles that are at couple seat positions
        const coupleSeats = map.filter(t => t.kind === "seat" && t.type === "couple");
        const positionsToRemove = new Set();
        
        coupleSeats.forEach(couple => {
            positionsToRemove.add(`${couple.x + 1},${couple.y}`);
        });
        
        // Filter out any empty tiles at marked positions
        const cleanMap = map.filter(tile => {
            const key = `${tile.x},${tile.y}`;
            if (positionsToRemove.has(key) && tile.kind === "empty") {
                return false; // Remove empty tiles at couple seat right positions
            }
            return true;
        });

        // Export to flat list format for saving
        const exportList = exportToFlatList();
        textarea.value = JSON.stringify(exportList, null, 2);
        
        // Update total seats field one more time before save
        const seatCount = calculateTotalSeats();
        if (totalSeatsField) {
            totalSeatsField.value = seatCount;
            // Trigger change event to ensure Django picks it up
            totalSeatsField.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Trigger the form save
        const form = textarea.closest('form');
        if (form) {
            // Check if there's a save button clicked
            const saveButton = document.querySelector('input[name="_save"]');
            if (saveButton) {
                form.submit();
            }
        }
        
        return true;
    }

    // Add row handler - now creates empty cells
    document.getElementById("add-row")?.addEventListener("click", () => {
        const newHeight = height + 1;
        
        // Check if adding row would exceed max seats
        const currentTotal = calculateTotalSeats();
        // Estimate worst case: all seats in new row could be filled
        if (currentTotal + width > 200) {
            showMessage(`Cannot add row: Would risk exceeding maximum limit of 200 seats.`, "error");
            return;
        }
        
        height = newHeight;
        const newY = height;
        
        for (let x = 1; x <= width; x++) {
            const exists = map.some(t => t.x === x && t.y === newY);
            if (!exists) {
                map.push({
                    x: x,
                    y: newY,
                    kind: "empty"
                });
            }
        }
        
        render();
        showMessage(`Added empty row ${String.fromCharCode(64 + height)}`);
    });

    // Add column handler - now creates empty cells
    document.getElementById("add-col")?.addEventListener("click", () => {
        const newWidth = width + 1;
        
        // Check if adding column would exceed max seats
        const currentTotal = calculateTotalSeats();
        // Estimate worst case: all seats in new column could be filled
        if (currentTotal + height > 200) {
            showMessage(`Cannot add column: Would risk exceeding maximum limit of 200 seats.`, "error");
            return;
        }
        
        width = newWidth;
        const newX = width;
        
        for (let y = 1; y <= height; y++) {
            const exists = map.some(t => t.x === newX && t.y === y);
            if (!exists) {
                map.push({
                    x: newX,
                    y: y,
                    kind: "empty"
                });
            }
        }
        
        render();
        showMessage(`Added empty column ${width}`);
    });

    // Remove row handler
    const removeRowBtn = document.createElement("button");
    removeRowBtn.type = "button";
    removeRowBtn.textContent = "➖ Remove Row";
    removeRowBtn.id = "remove-row";
    removeRowBtn.className = "btn btn-warning";
    removeRowBtn.onclick = () => {
        if (height <= 1) {
            showMessage("Cannot remove last row", "error");
            return;
        }
        
        if (confirm(`Remove last row?`)) {
            map = map.filter(t => t.y !== height);
            height--;
            render();
            showMessage(`Removed last row`);
        }
    };

    // Remove column handler
    const removeColBtn = document.createElement("button");
    removeColBtn.type = "button";
    removeColBtn.textContent = "➖ Remove Column";
    removeColBtn.id = "remove-col";
    removeColBtn.className = "btn btn-warning";
    removeColBtn.onclick = () => {
        if (width <= 1) {
            showMessage("Cannot remove last column", "error");
            return;
        }
        
        if (confirm(`Remove last column?`)) {
            map = map.filter(t => t.x !== width);
            width--;
            render();
            showMessage(`Removed last column`);
        }
    };

    // Add buttons to toolbar
    const toolbar = document.getElementById("designer-toolbar");
    if (toolbar) {
        toolbar.appendChild(removeRowBtn);
        toolbar.appendChild(removeColBtn);
        
        // Remove Aisle button from toolbar
        const aisleBtn = toolbar.querySelector('button[data-tool="aisle"]');
        if (aisleBtn) {
            aisleBtn.remove();
        }

        // Add Row tool button if it doesn't exist
        if (!toolbar.querySelector('button[data-tool="row"]')) {
            const rowBtn = document.createElement("button");
            rowBtn.type = "button";
            rowBtn.dataset.tool = "row";
            rowBtn.textContent = "Set Row";
            rowBtn.className = "btn";
            toolbar.insertBefore(rowBtn, toolbar.querySelector('button[data-tool="erase"]'));
        }
    }

    // Clear all button
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "Clear All";
    clearBtn.id = "clear-all";
    clearBtn.className = "btn btn-danger";
    clearBtn.onclick = () => {
        if (confirm("Clear all seats? This cannot be undone.")) {
            map = [];
            createDefaultMap();
            selectionStart = null;
            render();
            showMessage("All seats cleared");
        }
    };
    
    if (toolbar && !document.getElementById("clear-all")) {
        toolbar.appendChild(clearBtn);
    }

    // Override form submission
    const form = textarea.closest('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            if (!save()) {
                e.preventDefault();
                return false;
            }
        });
    }

    // Toolbar button handlers
    document.querySelectorAll("#designer-toolbar button[data-tool]").forEach(btn => {
        btn.onclick = () => {
            tool = btn.dataset.tool;
            selectionStart = null;
            
            document.querySelectorAll("#designer-toolbar button[data-tool]").forEach(b => 
                b.classList.remove("active")
            );
            btn.classList.add("active");
            
            const seatTypeSelect = document.getElementById("seat-type");
            if (seatTypeSelect) {
                // Keep seat type dropdown visible for both seat and row tools
                seatTypeSelect.style.display = (tool === "seat" || tool === "row") ? "inline-block" : "none";
            }
            
            // Re-render to update empty cell messages based on current tool/type
            render();
        };
    });

    // Seat type selector
    const seatTypeSelect = document.getElementById("seat-type");
    if (seatTypeSelect) {
        seatTypeSelect.onchange = (e) => {
            seatType = e.target.value;
            selectionStart = null;
            
            if (seatType === "couple") {
                showMessage("Click on first seat, then click adjacent seat to the right to combine");
            }
            
            // Re-render to update empty cell messages
            render();
        };
    }

    // Initialize
    validateMap();
    render();
});