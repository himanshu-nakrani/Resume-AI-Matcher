# OptiMatch UI Revamp - Implementation Guide

## Phase 5: Tracker/Board Enhancements

### 5.1 Board View Customization

#### View Density Options
```tsx
<BoardHeader>
  <ViewDensityToggle value={density} onChange={setDensity}>
    <ToggleOption value="compact">
      <LayoutCompact /> Compact
    </ToggleOption>
    <ToggleOption value="comfortable">
      <LayoutDefault /> Comfortable
    </ToggleOption>
    <ToggleOption value="spacious">
      <LayoutSpacious /> Spacious
    </ToggleOption>
  </ViewDensityToggle>
</BoardHeader>
```

**Density Styles**
```css
/* Compact */
.board-compact .card {
  padding: 0.5rem;
  gap: 0.5rem;
}

.board-compact .card-title {
  font-size: 0.875rem;
}

/* Comfortable (default) */
.board-comfortable .card {
  padding: 0.75rem;
  gap: 0.75rem;
}

/* Spacious */
.board-spacious .card {
  padding: 1.25rem;
  gap: 1rem;
}

.board-spacious .card-title {
  font-size: 1.125rem;
}
```

### 5.2 Drag & Drop Visual Feedback

```tsx
<DraggableCard
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  isDragging={isDragging}
>
  {/* Card content */}
</DraggableCard>

<DropZone
  onDragOver={handleDragOver}
  onDrop={handleDrop}
  isOver={isOver}
  canDrop={canDrop}
>
  {/* Column content */}
</DropZone>
```

**Drag Styles**
```css
.card-dragging {
  opacity: 0.5;
  transform: rotate(3deg);
  cursor: grabbing;
}

.card-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 1000;
  transform: rotate(5deg) scale(1.05);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.drop-zone-over {
  background: var(--primary-50);
  border: 2px dashed var(--primary);
}

.drop-zone-over::before {
  content: "Drop here";
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  inset: 0;
  font-weight: 600;
  color: var(--primary);
}
```

### 5.3 Quick Actions Menu

```tsx
<Card onMouseEnter={showQuickActions} onMouseLeave={hideQuickActions}>
  <CardContent>
    {/* Card content */}
  </CardContent>
  
  <QuickActionsMenu visible={showActions}>
    <QuickAction icon={<Eye />} onClick={viewDetails}>
      View
    </QuickAction>
    <QuickAction icon={<Edit />} onClick={editCard}>
      Edit
    </QuickAction>
    <QuickAction icon={<Copy />} onClick={duplicateCard}>
      Duplicate
    </QuickAction>
    <QuickAction icon={<Archive />} onClick={archiveCard}>
      Archive
    </QuickAction>
    <QuickAction icon={<Trash />} onClick={deleteCard} variant="danger">
      Delete
    </QuickAction>
  </QuickActionsMenu>
</Card>
```

**Quick Actions Animation**
```css
.quick-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.2s ease;
}

.card:hover .quick-actions {
  opacity: 1;
  transform: translateY(0);
}

.quick-action {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  transition: all 0.15s ease;
}

.quick-action:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
```

### 5.4 Timeline View

```tsx
<ViewToggle>
  <ToggleButton active={view === 'kanban'} onClick={() => setView('kanban')}>
    <LayoutGrid /> Kanban
  </ToggleButton>
  <ToggleButton active={view === 'timeline'} onClick={() => setView('timeline')}>
    <Calendar /> Timeline
  </ToggleButton>
</ViewToggle>

{view === 'timeline' && (
  <Timeline>
    <TimelineHeader>
      <TimelineMonth>January 2026</TimelineMonth>
      <TimelineMonth>February 2026</TimelineMonth>
      <TimelineMonth>March 2026</TimelineMonth>
    </TimelineHeader>
    
    <TimelineBody>
      {applications.map(app => (
        <TimelineItem
          key={app.id}
          startDate={app.appliedDate}
          endDate={app.deadline}
          status={app.status}
        >
          <TimelineCard>
            <h4>{app.jobTitle}</h4>
            <p>{app.companyName}</p>
          </TimelineCard>
        </TimelineItem>
      ))}
    </TimelineBody>
  </Timeline>
)}
```

### 5.5 Bulk Actions

```tsx
<BoardToolbar>
  <SelectAllCheckbox
    checked={selectedCards.length === totalCards}
    indeterminate={selectedCards.length > 0 && selectedCards.length < totalCards}
    onChange={toggleSelectAll}
  />
  
  {selectedCards.length > 0 && (
    <BulkActionsBar>
      <span>{selectedCards.length} selected</span>
      <BulkAction icon={<Edit />} onClick={bulkEdit}>
        Edit Status
      </BulkAction>
      <BulkAction icon={<Tag />} onClick={bulkTag}>
        Add Tags
      </BulkAction>
      <BulkAction icon={<Archive />} onClick={bulkArchive}>
        Archive
      </BulkAction>
      <BulkAction icon={<Trash />} onClick={bulkDelete} variant="danger">
        Delete
      </BulkAction>
    </BulkActionsBar>
  )}
</BoardToolbar>
```

### 5.6 Saved Filter Presets

```tsx
<FilterBar>
  <FilterPresets>
    <PresetButton active={preset === 'all'} onClick={() => loadPreset('all')}>
      All Applications
    </PresetButton>
    <PresetButton active={preset === 'urgent'} onClick={() => loadPreset('urgent')}>
      <Clock className="w-3 h-3" />
      Urgent (Deadline < 7 days)
    </PresetButton>
    <PresetButton active={preset === 'high-match'} onClick={() => loadPreset('high-match')}>
      <Target className="w-3 h-3" />
      High Match (>80%)
    </PresetButton>
    <PresetButton active={preset === 'remote'} onClick={() => loadPreset('remote')}>
      <Home className="w-3 h-3" />
      Remote Only
    </PresetButton>
  </FilterPresets>
  
  <SavePresetButton onClick={openSavePresetDialog}>
    <Plus className="w-3 h-3" />
    Save Current Filters
  </SavePresetButton>
</FilterBar>
```

### 5.7 Analytics Dashboard Widget

```tsx
<DashboardWidget>
  <WidgetHeader>
    <h3>Application Analytics</h3>
    <TimeRangeSelector value={timeRange} onChange={setTimeRange}>
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
    </TimeRangeSelector>
  </WidgetHeader>
  
  <WidgetContent>
    <MetricCard>
      <MetricValue>24</MetricValue>
      <MetricLabel>Total Applications</MetricLabel>
      <MetricChange positive>+12% from last period</MetricChange>
    </MetricCard>
    
    <MetricCard>
      <MetricValue>8</MetricValue>
      <MetricLabel>Interviews Scheduled</MetricLabel>
      <MetricChange positive>+33% from last period</MetricChange>
    </MetricCard>
    
    <MetricCard>
      <MetricValue>78%</MetricValue>
      <MetricLabel>Avg. Match Score</MetricLabel>
      <MetricChange>-2% from last period</MetricChange>
    </MetricCard>
    
    <ChartCard>
      <h4>Application Status Distribution</h4>
      <DonutChart data={statusDistribution} />
    </ChartCard>
    
    <ChartCard>
      <h4>Applications Over Time</h4>
      <LineChart data={applicationsOverTime} />
    </ChartCard>
  </WidgetContent>
</DashboardWidget>
```

---

## Phase 6: Analysis Page Improvements

### 6.1 Animated Score Visualization

```tsx
<ScoreSection>
  <ScoreGrid>
    <AnimatedScoreRing
      score={atsScore}
      label="ATS Score"
      color="primary"
      size="large"
      animationDelay={0}
    />
    <AnimatedScoreRing
      score={fitScore}
      label="Fit Score"
      color="success"
      size="large"
      animationDelay={200}
    />
    <AnimatedScoreRing
      score={keywordMatch}
      label="Keyword Match"
      color="warning"
      size="large"
      animationDelay={400}
    />
  </ScoreGrid>
  
  <ScoreBreakdown>
    <BreakdownItem
      label="Format & Structure"
      score={92}
      icon={<Layout />}
    />
    <BreakdownItem
      label="Keyword Optimization"
      score={85}
      icon={<Key />}
    />
    <BreakdownItem
      label="Experience Match"
      score={78}
      icon={<Briefcase />}
    />
    <BreakdownItem
      label="Skills Alignment"
      score={88}
      icon={<Award />}
    />
  </ScoreBreakdown>
</ScoreSection>
```

**Animated Score Ring**
```tsx
function AnimatedScoreRing({ score, label, color, size, animationDelay }) {
  const [displayScore, setDisplayScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const increment = score / 50; // 50 frames
      const interval = setInterval(() => {
        current += increment;
        if (current >= score) {
          setDisplayScore(score);
          clearInterval(interval);
        } else {
          setDisplayScore(Math.floor(current));
        }
      }, 20);
      return () => clearInterval(interval);
    }, animationDelay);
    
    return () => clearTimeout(timer);
  }, [score, animationDelay]);
  
  return (
    <div className="score-ring">
      <svg viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="var(--neutral-200)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`var(--${color})`}
          strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 45}`}
          strokeDashoffset={`${2 * Math.PI * 45 * (1 - displayScore / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out'
          }}
        />
      </svg>
      <div className="score-value">{displayScore}</div>
      <div className="score-label">{label}</div>
    </div>
  );
}
```

### 6.2 Tabbed Interface

```tsx
<AnalysisPage>
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">
        <LayoutDashboard className="w-4 h-4" />
        Overview
      </TabsTrigger>
      <TabsTrigger value="suggestions">
        <Lightbulb className="w-4 h-4" />
        Suggestions
        <Badge variant="primary">{suggestions.length}</Badge>
      </TabsTrigger>
      <TabsTrigger value="keywords">
        <Key className="w-4 h-4" />
        Keywords
      </TabsTrigger>
      <TabsTrigger value="comparison">
        <GitCompareArrows className="w-4 h-4" />
        Before/After
      </TabsTrigger>
      <TabsTrigger value="export">
        <Download className="w-4 h-4" />
        Export
      </TabsTrigger>
    </TabsList>
    
    <TabsContent value="overview">
      <OverviewTab />
    </TabsContent>
    
    <TabsContent value="suggestions">
      <SuggestionsTab />
    </TabsContent>
    
    <TabsContent value="keywords">
      <KeywordsTab />
    </TabsContent>
    
    <TabsContent value="comparison">
      <ComparisonTab />
    </TabsContent>
    
    <TabsContent value="export">
      <ExportTab />
    </TabsContent>
  </Tabs>
</AnalysisPage>
```

### 6.3 Before/After Comparison View

```tsx
<ComparisonView>
  <ComparisonHeader>
    <ViewModeToggle value={viewMode} onChange={setViewMode}>
      <ToggleOption value="side-by-side">
        <Columns2 /> Side by Side
      </ToggleOption>
      <ToggleOption value="slider">
        <SlidersHorizontal /> Slider
      </ToggleOption>
      <ToggleOption value="overlay">
        <Layers /> Overlay
      </ToggleOption>
    </ViewModeToggle>
  </ComparisonHeader>
  
  {viewMode === 'side-by-side' && (
    <SideBySideView>
      <ComparisonPanel title="Original Resume">
        <ResumePreview content={originalResume} />
      </ComparisonPanel>
      <ComparisonPanel title="Optimized Resume">
        <ResumePreview content={optimizedResume} highlighted />
      </ComparisonPanel>
    </SideBySideView>
  )}
  
  {viewMode === 'slider' && (
    <SliderView>
      <ImageComparisonSlider
        before={originalResumeImage}
        after={optimizedResumeImage}
      />
    </SliderView>
  )}
  
  {viewMode === 'overlay' && (
    <OverlayView>
      <DiffViewer
        original={originalResume}
        modified={optimizedResume}
        splitView={false}
      />
    </OverlayView>
  )}
</ComparisonView>
```

### 6.4 Inline Editing

```tsx
<OptimizedResume>
  <ResumeSection editable onEdit={handleEdit}>
    <SectionHeader>
      <h3>Professional Summary</h3>
      <EditButton />
    </SectionHeader>
    <SectionContent>
      <EditableText
        value={summary}
        onChange={setSummary}
        placeholder="Enter professional summary..."
      />
    </SectionContent>
  </ResumeSection>
  
  <ResumeSection editable onEdit={handleEdit}>
    <SectionHeader>
      <h3>Work Experience</h3>
      <AddButton onClick={addExperience} />
    </SectionHeader>
    <SectionContent>
      {experiences.map((exp, index) => (
        <ExperienceItem
          key={index}
          data={exp}
          onUpdate={(updated) => updateExperience(index, updated)}
          onDelete={() => deleteExperience(index)}
        />
      ))}
    </SectionContent>
  </ReResumeSection>
</OptimizedResume>
```

### 6.5 Export Options with Preview

```tsx
<ExportPanel>
  <ExportOptions>
    <ExportOption
      icon={<FileText />}
      title="LaTeX Source"
      description="Download the optimized LaTeX file"
      format="tex"
      onClick={() => exportResume('latex')}
    />
    <ExportOption
      icon={<FileType />}
      title="PDF Document"
      description="Generate and download PDF"
      format="pdf"
      onClick={() => exportResume('pdf')}
    />
    <ExportOption
      icon={<FileCode />}
      title="Markdown"
      description="Export as Markdown format"
      format="md"
      onClick={() => exportResume('markdown')}
    />
    <ExportOption
      icon={<FileJson />}
      title="JSON Data"
      description="Export structured data"
      format="json"
      onClick={() => exportResume('json')}
    />
  </ExportOptions>
  
  <ExportPreview>
    <PreviewHeader>
      <h3>Preview</h3>
      <ZoomControls>
        <Button size="sm" variant="ghost" onClick={zoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span>{zoom}%</span>
        <Button size="sm" variant="ghost" onClick={zoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
      </ZoomControls>
    </PreviewHeader>
    <PreviewContent zoom={zoom}>
      <ResumePreview content={optimizedResume} />
    </PreviewContent>
  </ExportPreview>
</ExportPanel>
```

### 6.6 Shareable Link with Branding

```tsx
<ShareDialog open={shareOpen} onClose={closeShare}>
  <DialogHeader>
    <h2>Share Analysis</h2>
  </DialogHeader>
  
  <DialogContent>
    <ShareOptions>
      <ShareOption
        icon={<Link2 />}
        title="Public Link"
        description="Anyone with the link can view"
        onClick={generatePublicLink}
      />
      <ShareOption
        icon={<Lock />}
        title="Password Protected"
        description="Require password to access"
        onClick={generateProtectedLink}
      />
      <ShareOption
        icon={<Clock />}
        title="Expiring Link"
        description="Link expires after set time"
        onClick={generateExpiringLink}
      />
    </ShareOptions>
    
    {shareLink && (
      <ShareLinkSection>
        <LinkInput value={shareLink} readOnly />
        <CopyButton onClick={() => copyToClipboard(shareLink)}>
          <Copy className="w-4 h-4" />
        </CopyButton>
      </ShareLinkSection>
    )}
    
    <BrandingOptions>
      <h4>Customize Branding</h4>
      <ColorPicker
        label="Primary Color"
        value={brandColor}
        onChange={setBrandColor}
      />
      <ImageUpload
        label="Logo"
        value={brandLogo}
        onChange={setBrandLogo}
      />
      <Input
        label="Custom Message"
        value={brandMessage}
        onChange={setBrandMessage}
        placeholder="Add a personal message..."
      />
    </BrandingOptions>
  </DialogContent>
  
  <DialogFooter>
    <Button variant="ghost" onClick={closeShare}>
      Cancel
    </Button>
    <Button variant="gradient" onClick={createShare}>
      Create Share Link
    </Button>
  </DialogFooter>
</ShareDialog>
```

---

## Phase 7: Mobile Responsiveness

### 7.1 Mobile Viewport Optimization

#### Breakpoint System
```css
/* Mobile First Approach */
:root {
  --breakpoint-xs: 320px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

/* Base styles (mobile) */
.container {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 1.5rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 2rem;
  }
}
```

#### Responsive Typography
```css
/* Fluid Typography */
.heading-1 {
  font-size: clamp(1.75rem, 4vw + 1rem, 3rem);
}

.heading-2 {
  font-size: clamp(1.5rem, 3vw + 1rem, 2.25rem);
}

.body-text {
  font-size: clamp(0.875rem, 2vw + 0.5rem, 1rem);
}
```

### 7.2 Touch-Friendly Interactions

```css
/* Minimum tap target size: 44x44px */
.button,
.link,
.interactive-element {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1rem;
}

/* Increase spacing for touch */
.mobile-nav-item {
  padding: 1rem;
  margin: 0.5rem 0;
}

/* Larger form inputs */
@media (max-width: 768px) {
  input,
  textarea,
  select {
    font-size: 16px; /* Prevents zoom on iOS */
    min-height: 44px;
  }
}
```

### 7.3 Swipe Gestures

```tsx
function useSwipeGesture(onSwipeLeft, onSwipeRight) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const minSwipeDistance = 50;
  
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) onSwipeLeft?.();
    if (isRightSwipe) onSwipeRight?.();
  };
  
  return { onTouchStart, onTouchMove, onTouchEnd };
}

// Usage
function MobileCard() {
  const swipeHandlers = useSwipeGesture(
    () => console.log('Swiped left'),
    () => console.log('Swiped right')
  );
  
  return (
    <div {...swipeHandlers}>
      Card content
    </div>
  );
}
```

### 7.4 Mobile-Optimized Images

```tsx
<ResponsiveImage
  src="/images/hero.jpg"
  srcSet="/images/hero-320w.jpg 320w,
          /images/hero-640w.jpg 640w,
          /images/hero-1024w.jpg 1024w"
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
  alt="Hero image"
  loading="lazy"
/>
```

### 7.5 Mobile Navigation Patterns

```tsx
<MobileNavigation>
  {/* Bottom Tab Bar */}
  <BottomTabBar>
    <TabItem icon={<Home />} label="Home" active />
    <TabItem icon={<Search />} label="Search" />
    <TabItem icon={<Plus />} label="Add" primary />
    <TabItem icon={<Bell />} label="Alerts" badge={3} />
    <TabItem icon={<User />} label="Profile" />
  </BottomTabBar>
  
  {/* Hamburger Menu */}
  <HamburgerMenu>
    <MenuButton onClick={toggleMenu}>
      <Menu />
    </MenuButton>
    <MenuDrawer open={menuOpen} onClose={closeMenu}>
      <MenuItems />
    </MenuDrawer>
  </HamburgerMenu>
  
  {/* Pull-to-Refresh */}
  <PullToRefresh onRefresh={handleRefresh}>
    <PageContent />
  </PullToRefresh>
</MobileNavigation>
```

---

## Phase 8: Accessibility & Performance

### 8.1 WCAG 2.1 AA Compliance

#### Color Contrast
```css
/* Ensure 4.5:1 contrast ratio for normal text */
/* Ensure 3:1 contrast ratio for large text (18px+ or 14px+ bold) */

:root {
  /* Light mode - AA compliant */
  --text-on-background: hsl(222, 47%, 11%);  /* #0f172a */
  --text-on-primary: hsl(0, 0%, 100%);       /* #ffffff */
  
  /* Dark mode - AA compliant */
  --text-on-dark-background: hsl(210, 40%, 98%);  /* #f8fafc */
  --text-on-dark-primary: hsl(222, 47%, 11%);     /* #0f172a */
}

/* Test contrast ratios */
.contrast-checker {
  background: var(--primary);
  color: var(--primary-foreground);
  /* Contrast ratio: 4.52:1 ✓ */
}
```

#### Keyboard Navigation
```tsx
function AccessibleButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label="Accessible button"
    >
      {children}
    </button>
  );
}

// Focus visible styles
button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### 8.2 ARIA Labels & Semantic HTML

```tsx
<nav aria-label="Main navigation">
  <ul role="list">
    <li>
      <a href="/" aria-current="page">
        Home
      </a>
    </li>
    <li>
      <a href="/tracker">
        Tracker
        <span className="sr-only">24 applications</span>
      </a>
    </li>
  </ul>
</nav>

<section aria-labelledby="recent-heading">
  <h2 id="recent-heading">Recent Optimizations</h2>
  {/* Content */}
</section>

<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  aria-controls="dialog-content"
>
  <X aria-hidden="true" />
</button>

<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {statusMessage}
</div>
```

### 8.3 Focus Management

```tsx
function Modal({ open, onClose, children }) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Trap focus within modal
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
```

### 8.4 Code Splitting & Lazy Loading

```tsx
// Route-based code splitting
const Home = lazy(() => import('./pages/home'));
const Board = lazy(() => import('./pages/board'));
const Analysis = lazy(() => import('./pages/analysis'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracker" element={<Board />} />
        <Route path="/analysis/:id" element={<Analysis />} />
      </Routes>
    </Suspense>
  );
}

// Component-based lazy loading
const HeavyChart = lazy(() => import('./components/heavy-chart'));

function Dashboard() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart data={data} />
      </Suspense>
    </div>
  );
}
```

### 8.5 Image Optimization

```tsx
// Lazy load images