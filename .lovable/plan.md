## SlideForge - Lightweight Slide Viewer

### Overview
A minimal, personal slide-viewing tool with PDF-style fixed aspect ratio slides. Built as a lightweight React app with local-only state management.

---

### Core Architecture

**1. Fixed Aspect Ratio Canvas (16:9)**
- All slides render at fixed 1920x1080 internal resolution
- Zoom controls scale the viewport without changing layout
- PDF-style viewing - what you see is what you export

**2. Slide Data Model (File-Based)**
- Each slide is a `.tsx` file in `src/slides/demo/`
- Full React power: hooks, animations, any component possible
- Slides are imported and rendered directly from code
- No database dependency for slide ordering

---

### Layout Templates (Pre-built)

1. **Title Slide** - Centered title + subtitle
2. **Section Header** - Bold header + optional description  
3. **Two-Column** - Header + left/right content areas
4. **Three-Up Cards** - Header + 3 equal content boxes
5. **Chart Focus** - Large chart area + side annotations
6. **Data Story** - Big number/metric + supporting content below
7. **Comparison** - Side-by-side with comparison headers
8. **Timeline** - Horizontal timeline with milestone content
9. **Quote/Highlight** - Large centered quote with attribution
10. **Blank Canvas** - Empty for fully custom layouts

---

### UI Layout

**Left Sidebar - Slide Navigator**
- Thumbnail previews of all slides (scaled-down renders)
- Click to navigate between slides
- Resizable width

**Main Canvas Area**
- Currently selected slide at editable zoom level
- Zoom controls (50%, 75%, 100%, 150%)
- Previous/next navigation
- Presentation mode (Shift+P)

**Bottom Panel - Presenter Notes (Optional)**
- Toggle with Shift+N
- Notes stored in database per slide
- Cmd+S to save

---

### Component System

**Built-in Components:**
- Text blocks (headings, paragraphs, lists)
- Images and videos
- Charts (bar, line, pie, etc. via Recharts)
- Code blocks with syntax highlighting
- Tables
- Shapes and dividers
- Metric/KPI cards
- Icons (via Lucide)

**Custom Component Freedom:**
- Full access to CSS animations
- Any React component possible within slides

---

### State Management

- **Local-only**: Slide order managed in React state
- **Presenter notes**: Stored in database (optional feature)
- **No authentication required**
- **Refreshing resets to default slide order**

---

### Design & Style

- **Minimal & Clean** aesthetic (Notion/Linear inspired)
- Monospace accents for technical feel
- Generous whitespace
- Subtle shadows and borders
- Dark mode support
- Smooth transitions and micro-interactions
