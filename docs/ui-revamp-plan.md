# OptiMatch UI Revamp - Comprehensive Design Plan

## Executive Summary

This document outlines a complete UI/UX overhaul for OptiMatch, transforming it into a modern, professional, and highly accessible resume optimization platform. The revamp focuses on visual excellence, seamless interactions, mobile-first design, and exceptional user experience.

## Vision & Goals

### Primary Objectives
- **Modern Aesthetic**: Implement contemporary design trends (glassmorphism, gradients, micro-interactions)
- **Enhanced UX**: Reduce cognitive load, improve information hierarchy, streamline workflows
- **Mobile Excellence**: Deliver a first-class mobile experience with touch-optimized interactions
- **Accessibility First**: Achieve WCAG 2.1 AA compliance across all features
- **Performance**: Maintain fast load times and smooth animations (60fps)

### Success Metrics
- Lighthouse Performance Score: 90+
- Lighthouse Accessibility Score: 95+
- Mobile Usability: 100%
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s

---

## Phase 1: Design System Enhancement

### 1.1 Color Palette Modernization

#### Primary Colors
```css
/* Light Mode */
--primary-50: hsl(217, 100%, 97%)
--primary-100: hsl(217, 95%, 93%)
--primary-200: hsl(217, 95%, 87%)
--primary-300: hsl(217, 92%, 78%)
--primary-400: hsl(217, 91%, 68%)
--primary-500: hsl(217, 91%, 60%)  /* Main brand color */
--primary-600: hsl(217, 83%, 53%)
--primary-700: hsl(217, 75%, 45%)
--primary-800: hsl(217, 70%, 37%)
--primary-900: hsl(217, 65%, 30%)

/* Dark Mode */
--primary-dark-50: hsl(217, 100%, 12%)
--primary-dark-500: hsl(217, 91%, 65%)  /* Brighter for dark mode */
```

#### Accent Colors
```css
/* Success Gradient */
--success-from: hsl(142, 76%, 36%)
--success-to: hsl(142, 71%, 45%)

/* Warning Gradient */
--warning-from: hsl(38, 92%, 50%)
--warning-to: hsl(45, 93%, 47%)

/* Error Gradient */
--error-from: hsl(0, 72%, 51%)
--error-to: hsl(0, 84%, 60%)

/* Info Gradient */
--info-from: hsl(199, 89%, 48%)
--info-to: hsl(199, 89%, 58%)
```

#### Neutral Scale (Enhanced)
```css
/* Light Mode */
--neutral-50: hsl(210, 40%, 98%)
--neutral-100: hsl(210, 40%, 96%)
--neutral-200: hsl(214, 32%, 91%)
--neutral-300: hsl(213, 27%, 84%)
--neutral-400: hsl(215, 20%, 65%)
--neutral-500: hsl(215, 16%, 47%)
--neutral-600: hsl(215, 19%, 35%)
--neutral-700: hsl(215, 25%, 27%)
--neutral-800: hsl(217, 33%, 17%)
--neutral-900: hsl(222, 47%, 11%)

/* Dark Mode - Warmer tones */
--neutral-dark-50: hsl(222, 47%, 6%)
--neutral-dark-900: hsl(210, 40%, 98%)
```

### 1.2 Typography System

#### Font Stack
```css
/* Primary Font - DM Sans (already in use, enhance weights) */
--font-sans: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-display: "DM Sans", sans-serif;  /* For headings */

/* Monospace - JetBrains Mono (already in use) */
--font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace;

/* Optional: Add a serif for elegance in certain contexts */
--font-serif: "Crimson Pro", Georgia, serif;
```

#### Type Scale (Enhanced)
```css
/* Display - Hero sections */
--text-display-2xl: 4.5rem;    /* 72px */
--text-display-xl: 3.75rem;    /* 60px */
--text-display-lg: 3rem;       /* 48px */

/* Headings */
--text-h1: 2.25rem;            /* 36px */
--text-h2: 1.875rem;           /* 30px */
--text-h3: 1.5rem;             /* 24px */
--text-h4: 1.25rem;            /* 20px */
--text-h5: 1.125rem;           /* 18px */
--text-h6: 1rem;               /* 16px */

/* Body */
--text-lg: 1.125rem;           /* 18px */
--text-base: 1rem;             /* 16px */
--text-sm: 0.875rem;           /* 14px */
--text-xs: 0.75rem;            /* 12px */
--text-2xs: 0.6875rem;         /* 11px */

/* Line Heights */
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;

/* Font Weights */
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
```

### 1.3 Spacing System

#### Base Unit: 4px
```css
--space-0: 0;
--space-px: 1px;
--space-0-5: 0.125rem;  /* 2px */
--space-1: 0.25rem;     /* 4px */
--space-1-5: 0.375rem;  /* 6px */
--space-2: 0.5rem;      /* 8px */
--space-2-5: 0.625rem;  /* 10px */
--space-3: 0.75rem;     /* 12px */
--space-3-5: 0.875rem;  /* 14px */
--space-4: 1rem;        /* 16px */
--space-5: 1.25rem;     /* 20px */
--space-6: 1.5rem;      /* 24px */
--space-7: 1.75rem;     /* 28px */
--space-8: 2rem;        /* 32px */
--space-9: 2.25rem;     /* 36px */
--space-10: 2.5rem;     /* 40px */
--space-11: 2.75rem;    /* 44px */
--space-12: 3rem;       /* 48px */
--space-14: 3.5rem;     /* 56px */
--space-16: 4rem;       /* 64px */
--space-20: 5rem;       /* 80px */
--space-24: 6rem;       /* 96px */
--space-28: 7rem;       /* 112px */
--space-32: 8rem;       /* 128px */
```

### 1.4 Border Radius System

```css
--radius-none: 0;
--radius-sm: 0.375rem;   /* 6px */
--radius-md: 0.5rem;     /* 8px */
--radius-lg: 0.75rem;    /* 12px */
--radius-xl: 1rem;       /* 16px */
--radius-2xl: 1.25rem;   /* 20px */
--radius-3xl: 1.5rem;    /* 24px */
--radius-full: 9999px;
```

### 1.5 Shadow System (Enhanced)

```css
/* Elevation Shadows */
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);

/* Colored Shadows for emphasis */
--shadow-primary: 0 10px 25px -5px rgb(59 130 246 / 0.3);
--shadow-success: 0 10px 25px -5px rgb(34 197 94 / 0.3);
--shadow-warning: 0 10px 25px -5px rgb(251 146 60 / 0.3);
--shadow-error: 0 10px 25px -5px rgb(239 68 68 / 0.3);

/* Inner shadows for depth */
--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
```

### 1.6 Animation & Transition System

```css
/* Durations */
--duration-75: 75ms;
--duration-100: 100ms;
--duration-150: 150ms;
--duration-200: 200ms;
--duration-300: 300ms;
--duration-500: 500ms;
--duration-700: 700ms;
--duration-1000: 1000ms;

/* Easing Functions */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-elastic: cubic-bezier(0.68, -0.6, 0.32, 1.6);

/* Common Transitions */
--transition-base: all var(--duration-200) var(--ease-out);
--transition-colors: color var(--duration-150) var(--ease-out),
                     background-color var(--duration-150) var(--ease-out),
                     border-color var(--duration-150) var(--ease-out);
--transition-transform: transform var(--duration-200) var(--ease-out);
--transition-opacity: opacity var(--duration-200) var(--ease-out);
```

### 1.7 Glassmorphism Effects

```css
/* Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
}

.dark .glass-card {
  background: rgba(17, 25, 40, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.125);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}

/* Glass Button */
.glass-button {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.glass-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}
```

---

## Phase 2: Component Library Improvements

### 2.1 Enhanced Button Component

#### New Variants

**Gradient Button**
```tsx
<Button variant="gradient" size="lg">
  <Sparkles className="w-4 h-4" />
  Optimize Resume
</Button>
```

**Glass Button**
```tsx
<Button variant="glass" size="md">
  <Search className="w-4 h-4" />
  Search Jobs
</Button>
```

**Animated Button (with ripple effect)**
```tsx
<Button variant="animated" size="lg">
  <Wand2 className="w-4 h-4" />
  Generate
</Button>
```

#### Button States & Interactions
- **Hover**: Subtle lift (translateY: -2px) + shadow increase
- **Active**: Slight scale down (scale: 0.98)
- **Loading**: Spinner animation + disabled state
- **Success**: Checkmark animation + green pulse
- **Error**: Shake animation + red pulse

### 2.2 Enhanced Card Component

#### Card Variants

**Elevated Card** (default)
```tsx
<Card variant="elevated" hover="lift">
  <CardHeader>
    <CardTitle>Job Title</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

**Glass Card**
```tsx
<Card variant="glass" hover="glow">
  <CardHeader>
    <CardTitle>Premium Feature</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

**Gradient Border Card**
```tsx
<Card variant="gradient-border" hover="scale">
  <CardHeader>
    <CardTitle>Highlighted Item</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

#### Hover Effects
- **lift**: translateY(-4px) + shadow-lg
- **glow**: box-shadow with primary color
- **scale**: scale(1.02)
- **tilt**: 3D tilt effect on hover

### 2.3 Loading Skeletons with Shimmer

```tsx
<Skeleton variant="shimmer" className="h-32 w-full" />
<Skeleton variant="pulse" className="h-4 w-3/4" />
<Skeleton variant="wave" className="h-64 w-full rounded-xl" />
```

**Shimmer Animation**
```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--neutral-200) 0%,
    var(--neutral-100) 50%,
    var(--neutral-200) 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

### 2.4 Enhanced Badge Component

#### Badge Variants with Icons

```tsx
<Badge variant="success" icon={<CheckCircle />}>
  Completed
</Badge>

<Badge variant="warning" icon={<Clock />} pulse>
  Pending
</Badge>

<Badge variant="gradient" icon={<Sparkles />}>
  Premium
</Badge>
```

#### Badge Animations
- **pulse**: Subtle scale pulse animation
- **bounce**: Bounce on mount
- **glow**: Glowing border animation

### 2.5 Enhanced Input/Textarea

#### Floating Label Pattern
```tsx
<FloatingInput
  id="email"
  label="Email Address"
  type="email"
  required
/>
```

#### Validation States
- **Success**: Green border + checkmark icon
- **Error**: Red border + error icon + shake animation
- **Warning**: Yellow border + warning icon
- **Loading**: Spinner in right side

#### Character Counter
```tsx
<Textarea
  maxLength={500}
  showCounter
  label="Job Description"
/>
```

### 2.6 Enhanced Toast Notifications

#### Toast Positions
- top-left, top-center, top-right
- bottom-left, bottom-center, bottom-right

#### Toast Variants
```tsx
toast.success("Resume optimized!", {
  icon: <CheckCircle />,
  duration: 3000,
  action: {
    label: "View",
    onClick: () => navigate("/analysis/123")
  }
});

toast.error("Optimization failed", {
  icon: <XCircle />,
  duration: 5000,
  action: {
    label: "Retry",
    onClick: () => retryOptimization()
  }
});

toast.loading("Optimizing resume...", {
  id: "optimize-toast"
});

// Update loading toast
toast.success("Done!", {
  id: "optimize-toast"
});
```

#### Toast Animations
- **Slide in**: From top/bottom/left/right
- **Fade in**: Opacity transition
- **Scale in**: Scale from 0.9 to 1
- **Bounce in**: Elastic bounce effect

---

## Phase 3: Layout & Navigation Revamp

### 3.1 Redesigned Sidebar

#### Collapsible Sections
```tsx
<Sidebar>
  <SidebarSection title="Main" collapsible defaultOpen>
    <SidebarItem icon={<Home />} href="/">Optimize</SidebarItem>
    <SidebarItem icon={<LayoutGrid />} href="/tracker">Tracker</SidebarItem>
  </SidebarSection>
  
  <SidebarSection title="Tools" collapsible>
    <SidebarItem icon={<GitCompareArrows />} href="/compare">Compare</SidebarItem>
    <SidebarItem icon={<GraduationCap />} href="/skills">Skills</SidebarItem>
  </SidebarSection>
  
  <SidebarSection title="Saved" collapsible>
    <SidebarItem icon={<Bookmark />} href="/saved-jobs" badge={12}>Saved Jobs</SidebarItem>
    <SidebarItem icon={<Bell />} href="/alerts" badge={3}>Alerts</SidebarItem>
  </SidebarSection>
</Sidebar>
```

#### Sidebar Features
- **Hover tooltips** for collapsed state
- **Active indicator** with animated underline
- **Badge notifications** for unread items
- **Quick actions** on hover (pin, settings)
- **Smooth collapse/expand** animation

### 3.2 Breadcrumb Navigation

```tsx
<Breadcrumb>
  <BreadcrumbItem href="/">Home</BreadcrumbItem>
  <BreadcrumbItem href="/tracker">Tracker</BreadcrumbItem>
  <BreadcrumbItem current>Analysis #123</BreadcrumbItem>
</Breadcrumb>
```

### 3.3 Sticky Header with Blur

```tsx
<Header sticky blur>
  <HeaderLeft>
    <Logo />
    <Breadcrumb />
  </HeaderLeft>
  <HeaderRight>
    <SearchBar />
    <NotificationBell />
    <ThemeToggle />
    <UserMenu />
  </HeaderRight>
</Header>
```

**Blur Effect**
```css
.header-blur {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}
```

### 3.4 Mobile Navigation - Bottom Sheet

```tsx
<MobileNav>
  <BottomSheet>
    <BottomSheetTrigger>
      <Menu />
    </BottomSheetTrigger>
    <BottomSheetContent>
      <NavItems />
    </BottomSheetContent>
  </BottomSheet>
</MobileNav>
```

### 3.5 Floating Action Button (FAB)

```tsx
<FAB position="bottom-right">
  <FABTrigger>
    <Plus />
  </FABTrigger>
  <FABMenu>
    <FABItem icon={<Upload />}>Upload Resume</FABItem>
    <FABItem icon={<Search />}>Search Jobs</FABItem>
    <FABItem icon={<Plus />}>New Analysis</FABItem>
  </FABMenu>
</FAB>
```

### 3.6 Enhanced Command Palette

#### Categorized Commands
```tsx
<CommandPalette>
  <CommandGroup heading="Navigation">
    <CommandItem icon={<Home />} shortcut="G H">Go to Home</CommandItem>
    <CommandItem icon={<LayoutGrid />} shortcut="G T">Go to Tracker</CommandItem>
  </CommandGroup>
  
  <CommandGroup heading="Actions">
    <CommandItem icon={<Upload />} shortcut="⌘ U">Upload Resume</CommandItem>
    <CommandItem icon={<Search />} shortcut="⌘ K">Search Jobs</CommandItem>
  </CommandGroup>
  
  <CommandGroup heading="Recent">
    <CommandItem icon={<Clock />}>Analysis #123</CommandItem>
    <CommandItem icon={<Clock />}>Analysis #122</CommandItem>
  </CommandGroup>
</CommandPalette>
```

---

## Phase 4: Home Page Redesign

### 4.1 Hero Section with Animated Gradient

```tsx
<HeroSection>
  <AnimatedGradientBackground />
  <HeroContent>
    <Badge variant="gradient" icon={<Sparkles />}>
      OptiMatch AI
    </Badge>
    <h1 className="hero-title">
      Upload once.
      <span className="gradient-text">Tailor every resume</span>
      for the role.
    </h1>
    <p className="hero-description">
      AI-powered resume optimization with ATS scoring,
      job tracking, and intelligent matching.
    </p>
    <HeroActions>
      <Button variant="gradient" size="xl">
        Get Started <ArrowRight />
      </Button>
      <Button variant="glass" size="xl">
        Watch Demo <Play />
      </Button>
    </HeroActions>
  </HeroContent>
  <HeroVisual>
    <AnimatedMockup />
  </HeroVisual>
</HeroSection>
```

**Animated Gradient Background**
```css
@keyframes gradient-shift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.animated-gradient {
  background: linear-gradient(
    135deg,
    hsl(217, 91%, 60%),
    hsl(262, 83%, 58%),
    hsl(173, 58%, 39%)
  );
  background-size: 200% 200%;
  animation: gradient-shift 15s ease infinite;
}
```

### 4.2 Redesigned Upload Area

```tsx
<UploadArea
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  isDragging={isDragging}
>
  <UploadIcon>
    <Upload className="w-12 h-12" />
  </UploadIcon>
  <UploadTitle>Drag & drop your resume</UploadTitle>
  <UploadDescription>
    or click to browse (PDF, LaTeX, TXT)
  </UploadDescription>
  <UploadButton variant="gradient">
    Choose File
  </UploadButton>
  {file && (
    <UploadedFile>
      <FileIcon />
      <FileName>{file.name}</FileName>
      <FileSize>{formatBytes(file.size)}</FileSize>
      <RemoveButton />
    </UploadedFile>
  )}
</UploadArea>
```

**Drag & Drop Visual Feedback**
```css
.upload-area {
  transition: all 0.3s ease;
  border: 2px dashed var(--border);
}

.upload-area.dragging {
  border-color: var(--primary);
  background: var(--primary-50);
  transform: scale(1.02);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.upload-area.dragging .upload-icon {
  animation: bounce 0.6s ease infinite;
}
```

### 4.3 Enhanced Job Search UI

#### Slide-over Filter Panel
```tsx
<JobSearch>
  <SearchBar>
    <SearchInput
      placeholder="Search for jobs..."
      value={query}
      onChange={setQuery}
    />
    <FilterButton onClick={openFilters}>
      <SlidersHorizontal />
      Filters {activeFilters > 0 && `(${activeFilters})`}
    </FilterButton>
  </SearchBar>
  
  <SlideOver open={filtersOpen} onClose={closeFilters}>
    <SlideOverHeader>
      <h2>Advanced Filters</h2>
      <CloseButton />
    </SlideOverHeader>
    <SlideOverContent>
      <FilterSection title="Experience Level">
        <CheckboxGroup>
          <Checkbox label="Entry Level" />
          <Checkbox label="Mid Level" />
          <Checkbox label="Senior" />
        </CheckboxGroup>
      </FilterSection>
      
      <FilterSection title="Job Type">
        <RadioGroup>
          <Radio label="Full-time" />
          <Radio label="Contract" />
          <Radio label="Part-time" />
        </RadioGroup>
      </FilterSection>
      
      <FilterSection title="Remote">
        <Select>
          <option>Any</option>
          <option>Remote</option>
          <option>Hybrid</option>
          <option>On-site</option>
        </Select>
      </FilterSection>
      
      <FilterSection title="Salary Range">
        <RangeSlider
          min={0}
          max={300000}
          step={10000}
          value={salaryRange}
          onChange={setSalaryRange}
        />
      </FilterSection>
    </SlideOverContent>
    <SlideOverFooter>
      <Button variant="ghost" onClick={clearFilters}>
        Clear All
      </Button>
      <Button variant="gradient" onClick={applyFilters}>
        Apply Filters
      </Button>
    </SlideOverFooter>
  </SlideOver>
</JobSearch>
```

### 4.4 Enhanced Job Cards

```tsx
<JobCard hover="lift" variant="elevated">
  <JobCardHeader>
    <CompanyLogo src={job.logo} alt={job.company} />
    <JobCardMeta>
      <JobTitle>{job.title}</JobTitle>
      <CompanyName>{job.company}</CompanyName>
      <JobLocation>
        <MapPin className="w-3 h-3" />
        {job.location}
      </JobLocation>
    </JobCardMeta>
    <BookmarkButton />
  </JobCardHeader>
  
  <JobCardContent>
    <JobDescription>{job.description}</JobDescription>
    
    <JobTags>
      {job.tags.map(tag => (
        <Badge key={tag} variant="secondary" size="sm">
          {tag}
        </Badge>
      ))}
    </JobTags>
    
    <JobMetrics>
      <Metric icon={<DollarSign />} label="Salary">
        {job.salary}
      </Metric>
      <Metric icon={<Clock />} label="Posted">
        {job.postedAt}
      </Metric>
      <Metric icon={<Users />} label="Applicants">
        {job.applicants}
      </Metric>
    </JobMetrics>
  </JobCardContent>
  
  <JobCardFooter>
    <MatchScore score={job.matchScore} />
    <JobCardActions>
      <Button variant="outline" size="sm">
        View Details
      </Button>
      <Button variant="gradient" size="sm">
        Apply Now
      </Button>
    </JobCardActions>
  </JobCardFooter>
</JobCard>
```

### 4.5 Skeleton Loading States

```tsx
// Job Search Loading
<JobSearchSkeleton>
  <Skeleton variant="shimmer" className="h-12 w-full mb-4" />
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {[1, 2, 3, 4].map(i => (
      <JobCardSkeleton key={i} />
    ))}
  </div>
</JobSearchSkeleton>

// Job Card Skeleton
<JobCardSkeleton>
  <Skeleton variant="shimmer" className="h-16 w-16 rounded-lg" />
  <div className="flex-1 space-y-2">
    <Skeleton variant="shimmer" className="h-6 w-3/4" />
    <Skeleton variant="shimmer" className="h-4 w-1/2" />
    <Skeleton variant="shimmer" className="h-4 w-full" />
  </div>
</JobCardSkeleton>
```

### 4.6 Empty States with Illustrations

```tsx
<EmptyState
  illustration={<NoJobsIllustration />}
  title="No jobs found"
  description="Try adjusting your filters or search query"
  action={
    <Button variant="gradient" onClick={clearFilters}>
      Clear Filters
    </Button>
  }
/>

<EmptyState
  illustration={<NoResumesIllustration />}
  title="No resumes yet"
  description="Upload your first resume to get started"
  action={
    <Button variant="gradient" onClick={openUpload}>
      <Upload className="w-4 h-4" />
      Upload Resume
    </Button>
  }
/>
```

### 4.7 Onboarding Tour

```tsx
<OnboardingTour
  steps={[
    {
      target: "#upload-area",
      title: "Upload Your Resume",
      content: "Start by uploading your resume in PDF, LaTeX, or TXT format.",
      placement: "bottom"
    },
    {
      target: "#job-search",
      title: "Search for Jobs",
      content: "Use our AI-powered job search to find relevant opportunities.",
      placement: "bottom"
    },
    {
      target: "#optimize-button",
      title: "Optimize Your Resume",
      content: "Click here to generate an ATS-optimized resume tailored to the job.",
      placement: "top"
    },
    {
      target: "#tracker-link",
      title: "Track Applications",
      content: "All optimizations are automatically added to your tracker.",
      placement