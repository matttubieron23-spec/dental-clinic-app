import { useEffect, useState } from 'react';
import { api } from './api';
import SITE_IMAGES from './config/siteImages';
import { formatFriendlyDate } from './config';
import { Badge, Button, Card, Icon, InputField } from './ui';

export const CLINIC_INFO = {
  name: 'Smile Avenue Dental Clinic',
  shortName: 'Smile Avenue',
  tagline: 'Gentle, Modern & Trusted Dental Care in Legazpi City',
  phone: '0969 059 1928',
  email: 'smileavdental@gmail.com',
  address: 'G/F Yankit Building, Landco Business Park, Legazpi City, Albay 4500',
  hours: 'Monday – Saturday · 8:00 AM – 5:00 PM',
  lunch: '12:00 PM – 1:00 PM (Lunch Break)',
  closed: 'Closed on Sundays & Holidays',
};

const HIGHLIGHTS = [
  {
    id: 'sterilization',
    title: 'Hospital-Grade Sterilization',
    description:
      'Every instrument undergoes strict autoclave sterilization and sealed pouching for complete patient safety.',
    image: SITE_IMAGES?.highlights?.sterilization,
  },
  {
    id: 'equipment',
    title: 'Modern Digital Dentistry',
    description:
      'Equipped with digital diagnostics and ergonomic dental chairs for accurate, minimally invasive treatments.',
    image: SITE_IMAGES?.highlights?.equipment,
  },
  {
    id: 'comfort',
    title: 'Patient-First Comfort',
    description:
      'A calm, welcoming environment in Landco Business Park designed for both kids and adults.',
    image: SITE_IMAGES?.highlights?.comfort,
  },
];

const SERVICES = [
  {
    category: 'Preventive & General',
    title: 'Consultation & Oral Prophylaxis',
    description:
      'Comprehensive dental checkups, ultrasonic scaling, stain removal, and fluoride treatments to keep gums healthy.',
    priceHint: 'Starts at ₱800',
  },
  {
    category: 'Restorative Care',
    title: 'Tooth-Colored Fillings & Bonding',
    description:
      'Natural-looking composite restorations that repair cavities, chipped edges, and worn enamel seamlessly.',
    priceHint: 'Starts at ₱1,000',
  },
  {
    category: 'Oral Surgery',
    title: 'Gentle Tooth Extraction & Wisdom Tooth Care',
    description:
      'Safe, pain-managed simple and surgical extractions with clear post-operative recovery guidance.',
    priceHint: 'Starts at ₱1,200',
  },
  {
    category: 'Prosthodontics',
    title: 'Crowns, Bridges & Dentures',
    description:
      'Custom-crafted porcelain crowns, fixed bridges, and flexible or complete dentures to restore your bite.',
    priceHint: 'Custom quote after exam',
  },
  {
    category: 'Orthodontics',
    title: 'Braces & Clear Aligners',
    description:
      'Metallic, ceramic, and clear orthodontic solutions to align crowded teeth and correct bite issues.',
    priceHint: 'Consultation required',
  },
  {
    category: 'Cosmetic Dentistry',
    title: 'Teeth Whitening & Veneers',
    description:
      'Safe chairside brightening and custom veneers designed to give you a confident, radiant smile.',
    priceHint: 'Starts at ₱4,500',
  },
];

const DENTAL_TEAM_MEMBERS = [
  {
    name: 'Dr. Camille Natural-Demillo, DMD',
    role: 'Lead Dentist · General & Cosmetic Dentistry',
    bio: 'Dedicated to gentle, patient-centered care with a focus on restorative, aesthetic, and preventive family dentistry.',
  },
  {
    name: 'Dr. Jane Smith, DMD',
    role: 'Associate Dentist · Restorative & Pediatric Care',
    bio: 'Passionate about making dental visits stress-free for children and adults through clear communication and gentle technique.',
  },
  {
    name: 'Dr. Carlo Reyes, DMD',
    role: 'Orthodontics & Prosthodontics Specialist',
    bio: 'Experienced in bite alignment, dental crowns, and full-arch rehabilitations tailored to each patient.',
  },
];

// ============================================================================
// REUSABLE IMAGE PLACEHOLDER & SAFE IMAGE COMPONENT
// Enforces object-fit: cover and displays a clean "Image coming soon" box if empty/broken
// ============================================================================
export function SafeImage({
  src,
  alt,
  className = 'h-full w-full object-cover',
  wrapperClassName = 'h-64 w-full',
  placeholderLabel = 'Image coming soon',
}) {
  const [hasError, setHasError] = useState(false);
  const cleanSrc = typeof src === 'string' ? src.trim() : '';
  const showPlaceholder = !cleanSrc || hasError;

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${wrapperClassName}`}>
      {!showPlaceholder ? (
        <img
          src={cleanSrc}
          alt={alt || CLINIC_INFO.name}
          onError={() => setHasError(true)}
          loading="lazy"
          className={className}
        />
      ) : (
        <div
          role="img"
          aria-label={alt || placeholderLabel}
          className="flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500 select-none"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/70 text-slate-500">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {placeholderLabel}
          </span>
          {alt && (
            <span className="max-w-xs text-[11px] font-medium text-slate-400 line-clamp-1">
              {alt}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function BrandLogo({ className = '' }) {
  const [logoError, setLogoError] = useState(false);
  const logoSrc = typeof SITE_IMAGES?.logo === 'string' ? SITE_IMAGES.logo.trim() : '';

  if (logoSrc && !logoError) {
    return (
      <img
        src={logoSrc}
        alt={`${CLINIC_INFO.name} Logo`}
        onError={() => setLogoError(true)}
        className={`h-10 w-auto max-w-[160px] shrink-0 object-contain ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-base font-extrabold text-white shadow-xs shadow-blue-600/25 ${className}`}
    >
      S
    </span>
  );
}

function StarRatingDisplay({ rating = 5 }) {
  const r = Math.max(1, Math.min(5, Number(rating) || 5));
  return (
    <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${r} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${
            star <= r ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
          }`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function PublicSite({
  patientUser,
  onOpenAuth,
  onGoBook,
  onGoDashboard,
  onGoStaff,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    bot_field: '',
  });
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [inquirySuccess, setInquirySuccess] = useState('');

  useEffect(() => {
    let active = true;
    api('api/public/reviews')
      .then((rows) => {
        if (active && Array.isArray(rows)) {
          setReviews(rows);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePrimaryBookClick = () => {
    setMobileMenuOpen(false);
    if (patientUser) {
      onGoBook?.();
    } else {
      onOpenAuth?.('login', '/book');
    }
  };

  const handleScrollTo = (sectionId) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setInquiryError('');
    setInquirySuccess('');

    if (
      !inquiryForm.name.trim() ||
      !inquiryForm.email.trim() ||
      !inquiryForm.phone.trim() ||
      !inquiryForm.message.trim()
    ) {
      setInquiryError('Please fill in your full name, email address, mobile number, and message.');
      return;
    }

    setSendingInquiry(true);
    try {
      const res = await api('api/public/inquiries', {
        method: 'POST',
        body: inquiryForm,
      });
      setInquirySuccess(
        res.message || 'Thank you! Your message has been sent to Smile Avenue Dental Clinic.'
      );
      setInquiryForm({ name: '', email: '', phone: '', message: '', bot_field: '' });
    } catch (err) {
      setInquiryError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSendingInquiry(false);
    }
  };

  // Supports both SITE_IMAGES.dentalTeam and fallback SITE_IMAGES.dentists.leadDentist
  const dentalTeamGroupImage =
    SITE_IMAGES?.dentalTeam || SITE_IMAGES?.dentists?.leadDentist || '';

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* =================================================================== */}
      {/* 1. STICKY HEADER (Fitted Logo + Nav + Mobile Hamburger Menu) */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setMobileMenuOpen(false);
            }}
            className="flex min-w-0 items-center gap-3 focus:outline-none"
          >
            <BrandLogo />
            <div className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {CLINIC_INFO.shortName}
              </span>
              <span className="block truncate text-xs font-medium text-blue-600">
                Dental Clinic · Legazpi City
              </span>
            </div>
          </a>

          <nav
            aria-label="Main Navigation"
            className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex"
          >
            <button
              type="button"
              onClick={() => handleScrollTo('about')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => handleScrollTo('services')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => handleScrollTo('dentists')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Our Team
            </button>
            <button
              type="button"
              onClick={() => handleScrollTo('reviews')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Reviews
            </button>
            <button
              type="button"
              onClick={() => handleScrollTo('contact')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Contact
            </button>
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            {patientUser ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onGoDashboard}
              >
                My Portal ({patientUser.first_name})
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenAuth?.('login', '/dashboard')}
              >
                Patient Login
              </Button>
            )}

            <Button
              type="button"
              variant="primary"
              onClick={handlePrimaryBookClick}
            >
              Book an Appointment
            </Button>
          </div>

          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 md:hidden cursor-pointer"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 pt-3 pb-6 shadow-xl md:hidden">
            <nav className="flex flex-col space-y-1 text-sm font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => handleScrollTo('about')}
                className="rounded-xl px-3.5 py-2.5 text-left hover:bg-slate-100"
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo('services')}
                className="rounded-xl px-3.5 py-2.5 text-left hover:bg-slate-100"
              >
                Dental Services
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo('dentists')}
                className="rounded-xl px-3.5 py-2.5 text-left hover:bg-slate-100"
              >
                Our Dental Team
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo('reviews')}
                className="rounded-xl px-3.5 py-2.5 text-left hover:bg-slate-100"
              >
                Patient Reviews
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo('contact')}
                className="rounded-xl px-3.5 py-2.5 text-left hover:bg-slate-100"
              >
                Contact &amp; Location
              </button>
            </nav>

            <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="primary"
                onClick={handlePrimaryBookClick}
                className="w-full"
              >
                Book an Appointment
              </Button>

              {patientUser ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGoDashboard?.();
                  }}
                  className="w-full"
                >
                  Open My Patient Portal
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth?.('login', '/dashboard');
                    }}
                  >
                    Patient Login
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth?.('register', '/dashboard');
                    }}
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =================================================================== */}
      {/* 2. HERO SECTION (Stacks Text on Top, Image Below on Mobile) */}
      {/* =================================================================== */}
      <section
        id="top"
        className="border-b border-slate-200/80 bg-gradient-to-b from-blue-50/60 via-white to-white py-14 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Hero Copy (Top on Mobile, Left on Desktop) */}
            <div className="space-y-6 lg:col-span-6">
              <Badge tone="info" className="!px-3.5 !py-1">
                Landco Business Park, Legazpi City
              </Badge>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl lg:leading-[1.12]">
                Healthy, Confident Smiles Crafted with{' '}
                <span className="text-blue-600">Gentle Care.</span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Welcome to <strong>{CLINIC_INFO.name}</strong>. Whether you need a routine
                checkup, painless tooth extraction, braces, or a complete smile makeover, our
                team is here to care for you and your family.
              </p>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handlePrimaryBookClick}
                  className="!h-12 !px-6"
                >
                  Book an Appointment
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleScrollTo('services')}
                  className="!h-12 !px-6"
                >
                  Explore Our Services
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-6 text-xs sm:grid-cols-3">
                <div>
                  <span className="block font-bold text-slate-900">Mon – Sat</span>
                  <span className="font-medium text-slate-500">8:00 AM – 5:00 PM</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-900">Direct Hotline</span>
                  <span className="font-medium text-slate-500">{CLINIC_INFO.phone}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="block font-bold text-slate-900">Online Booking</span>
                  <span className="font-medium text-slate-500">24/7 Patient Portal</span>
                </div>
              </div>
            </div>

            {/* Hero Image (Bottom on Mobile, Right on Desktop, object-fit: cover) */}
            <div className="lg:col-span-6">
              <Card noPadding className="p-2.5">
                <SafeImage
                  src={SITE_IMAGES?.hero}
                  alt="Smile Avenue Dental Clinic Treatment Room"
                  wrapperClassName="h-72 sm:h-96 lg:h-[420px] w-full rounded-xl"
                  className="h-full w-full object-cover"
                  placeholderLabel="Image coming soon"
                />
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. CLINIC HIGHLIGHTS SECTION */}
      {/* =================================================================== */}
      <section className="bg-[#F4F6F9] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Why Choose Smile Avenue
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Safe, Comfortable &amp; Modern Dental Visits
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              We combine strict clinical sterilization with a warm, approachable atmosphere so
              every patient feels at ease in the dental chair.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <Card
                key={item.id}
                noPadding
                className="flex flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <SafeImage
                  src={item.image}
                  alt={item.title}
                  wrapperClassName="h-52 w-full border-b border-slate-100"
                  className="h-full w-full object-cover"
                  placeholderLabel="Image coming soon"
                />
                <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 4. ABOUT SECTION */}
      {/* =================================================================== */}
      <section
        id="about"
        className="scroll-mt-20 border-y border-slate-200/80 bg-white py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="order-2 lg:order-1 lg:col-span-6">
              <Card noPadding className="p-2.5">
                <SafeImage
                  src={SITE_IMAGES?.about}
                  alt="About Smile Avenue Dental Clinic in Legazpi City"
                  wrapperClassName="h-72 sm:h-96 w-full rounded-xl"
                  className="h-full w-full object-cover"
                  placeholderLabel="Image coming soon"
                />
              </Card>
            </div>

            <div className="order-1 space-y-6 lg:order-2 lg:col-span-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                  About Our Clinic
                </span>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Your Trusted Neighborhood Dental Partner in Albay
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Conveniently located at the Ground Floor of the Yankit Building in Landco
                Business Park, <strong>{CLINIC_INFO.name}</strong> provides comprehensive
                dental care for individuals and families across Legazpi City and the Bicol
                region.
              </p>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                We believe in transparent treatment planning—explaining every procedure,
                surface, and cost clearly before we begin, and giving our patients digital
                access to their appointment schedules and medical records.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-blue-600">
                    Transparent Care
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Clear explanations and itemized treatment plans with zero surprise fees.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-blue-600">
                    RA 10173 Compliant
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Strict adherence to the Philippine Data Privacy Act for your dental records.
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handlePrimaryBookClick}
                >
                  Schedule a Visit Today
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. SERVICES SECTION */}
      {/* =================================================================== */}
      <section
        id="services"
        className="scroll-mt-20 bg-[#F4F6F9] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Our Dental Services
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Comprehensive Treatments Under One Roof
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              From preventive cleanings to orthodontic braces and cosmetic restorations, we
              tailor every procedure to your dental goals.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((svc) => (
              <Card
                key={svc.title}
                className="flex flex-col justify-between transition-all hover:border-blue-300"
              >
                <div>
                  <Badge tone="info">{svc.category}</Badge>
                  <h3 className="mt-4 text-base font-bold text-slate-900">
                    {svc.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {svc.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-slate-500">{svc.priceHint}</span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={handlePrimaryBookClick}
                  >
                    Book Service →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 6. MEET OUR DENTAL TEAM (Single Featured Group Photo + Team Roster) */}
      {/* =================================================================== */}
      <section
        id="dentists"
        className="scroll-mt-20 border-y border-slate-200/80 bg-white py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Meet Our Dental Team
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Experienced, Caring &amp; Licensed Dentists
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Our clinicians work together as one collaborative team to listen to your concerns
              and deliver gentle, evidence-based dental treatments.
            </p>
          </div>

          {/* Single Featured Group Photo + Unified Team Credentials Card */}
          <div className="mt-12">
            <Card noPadding className="overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left / Top on Mobile: One Group Photo of the Dentists */}
                <div className="lg:col-span-7">
                  <SafeImage
                    src={dentalTeamGroupImage}
                    alt="Smile Avenue Dental Clinic Team of Dentists"
                    wrapperClassName="h-80 sm:h-[420px] lg:h-full min-h-[340px] w-full"
                    className="h-full w-full object-cover"
                    placeholderLabel="Dental Team Group Photo Coming Soon"
                  />
                </div>

                {/* Right / Bottom on Mobile: Clinician Roster & Booking CTA */}
                <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-5">
                  <div className="space-y-5">
                    <div>
                      <Badge tone="info">Smile Avenue Clinical Team</Badge>
                      <h3 className="mt-3 text-xl font-bold text-slate-900">
                        Dedicated to Your Family&apos;s Oral Health
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        Every member of our dental team is licensed and trained in modern, pain-managed dentistry.
                      </p>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {DENTAL_TEAM_MEMBERS.map((doc) => (
                        <div key={doc.name} className="py-3.5 first:pt-0 last:pb-0">
                          <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                          <p className="text-xs font-semibold text-blue-600">{doc.role}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {doc.bio}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handlePrimaryBookClick}
                      className="w-full"
                    >
                      Book an Appointment with Our Team
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 7. PATIENT REVIEWS SECTION (Privacy-Masked Names) */}
      {/* =================================================================== */}
      <section
        id="reviews"
        className="scroll-mt-20 bg-[#F4F6F9] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Verified Patient Stories
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Patient Reviews
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Read real experiences from our patients. Names are privacy-masked in accordance
              with the Data Privacy Act.
            </p>
          </div>

          {loadingReviews ? (
            <p className="mt-10 text-center text-xs font-medium text-slate-500">
              Loading patient reviews...
            </p>
          ) : reviews.length === 0 ? (
            <div className="mx-auto mt-10 max-w-md">
              <Card className="text-center">
                <p className="text-sm font-bold text-slate-800">No patient reviews yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Registered patients can leave a review anytime from their Patient Portal.
                </p>
              </Card>
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((rev) => (
                <Card
                  key={rev.id}
                  className="flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <StarRatingDisplay rating={rev.rating} />
                      <span className="text-xs font-medium text-slate-400">
                        {rev.created_date
                          ? formatFriendlyDate(rev.created_date, false)
                          : ''}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-slate-700">
                      &ldquo;{rev.review_text}&rdquo;
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {String(rev.masked_name || 'P')[0].toUpperCase()}
                      </span>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">
                          {rev.masked_name}
                        </span>
                        <span className="block text-[11px] font-semibold text-emerald-600">
                          ✓ Verified Patient
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 8. CONTACT, INQUIRY FORM & MAP SECTION */}
      {/* =================================================================== */}
      <section
        id="contact"
        className="scroll-mt-20 border-t border-slate-200/80 bg-[#F4F6F9] pb-16 sm:pb-24 pt-12"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="space-y-6 lg:col-span-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                  Visit or Contact Us
                </span>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  We&apos;d Love to Hear From You
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Have a question about a dental procedure, HMO accreditation, or clinic
                  availability? Send us a message or visit our clinic in Legazpi City.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card noPadding className="p-5">
                  <span className="block text-xs font-semibold text-slate-400">
                    Clinic Address
                  </span>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">
                    {CLINIC_INFO.address}
                  </p>
                </Card>

                <Card noPadding className="p-5">
                  <span className="block text-xs font-semibold text-slate-400">
                    Phone &amp; Email
                  </span>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">
                    {CLINIC_INFO.phone}
                  </p>
                  <p className="text-xs font-semibold text-blue-600">{CLINIC_INFO.email}</p>
                </Card>

                <Card noPadding className="p-5 sm:col-span-2">
                  <span className="block text-xs font-semibold text-slate-400">
                    Clinic Hours
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900">{CLINIC_INFO.hours}</p>
                  <p className="text-xs font-medium text-slate-500">
                    {CLINIC_INFO.lunch} · {CLINIC_INFO.closed}
                  </p>
                </Card>
              </div>

              <Card noPadding className="overflow-hidden p-2">
                <iframe
                  title="Smile Avenue Dental Clinic Location Map"
                  src="https://www.google.com/maps?q=Landco+Business+Park+Legazpi+City+Albay&output=embed"
                  className="h-64 w-full rounded-xl border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </Card>
            </div>

            <div className="lg:col-span-6">
              <Card className="p-7 sm:p-8">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">
                    Send Us a Message
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Our front desk team responds to web inquiries during clinic hours.
                  </p>
                </div>

                <form onSubmit={handleInquirySubmit} noValidate className="mt-6 space-y-4">
                  <input
                    type="text"
                    name="bot_field"
                    value={inquiryForm.bot_field}
                    onChange={(e) =>
                      setInquiryForm({ ...inquiryForm, bot_field: e.target.value })
                    }
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {inquiryError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
                    >
                      {inquiryError}
                    </div>
                  )}

                  {inquirySuccess && (
                    <div
                      role="status"
                      className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800"
                    >
                      {inquirySuccess}
                    </div>
                  )}

                  <InputField
                    label="Full Name"
                    required
                    placeholder="e.g. Juan Dela Cruz"
                    value={inquiryForm.name}
                    onChange={(e) =>
                      setInquiryForm({ ...inquiryForm, name: e.target.value })
                    }
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InputField
                      label="Email Address"
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={inquiryForm.email}
                      onChange={(e) =>
                        setInquiryForm({ ...inquiryForm, email: e.target.value })
                      }
                    />

                    <InputField
                      label="Mobile Number (PH)"
                      type="tel"
                      required
                      placeholder="0917 123 4567"
                      value={inquiryForm.phone}
                      onChange={(e) =>
                        setInquiryForm({ ...inquiryForm, phone: e.target.value })
                      }
                    />
                  </div>

                  <InputField
                    label="How can we help you?"
                    as="textarea"
                    rows={4}
                    required
                    placeholder="Tell us about your dental concern or preferred visit date..."
                    value={inquiryForm.message}
                    onChange={(e) =>
                      setInquiryForm({ ...inquiryForm, message: e.target.value })
                    }
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={sendingInquiry}
                      className="w-full"
                    >
                      {sendingInquiry ? 'Sending Message...' : 'Send Inquiry'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 9. FOOTER */}
      {/* =================================================================== */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-3">
                <BrandLogo />
                <span className="text-lg font-bold text-white">
                  {CLINIC_INFO.name}
                </span>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                {CLINIC_INFO.address}. Dedicated to providing gentle, modern, and accessible
                dental care for patients in Legazpi City and Albay.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <span className="block font-bold uppercase tracking-wider text-white">
                Quick Links
              </span>
              <ul className="space-y-1.5 text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() => handleScrollTo('about')}
                    className="hover:text-white cursor-pointer"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleScrollTo('services')}
                    className="hover:text-white cursor-pointer"
                  >
                    Dental Services
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleScrollTo('dentists')}
                    className="hover:text-white cursor-pointer"
                  >
                    Our Dental Team
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleScrollTo('reviews')}
                    className="hover:text-white cursor-pointer"
                  >
                    Patient Reviews
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <span className="block font-bold uppercase tracking-wider text-white">
                Portals
              </span>
              <ul className="space-y-1.5 text-slate-400">
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      patientUser ? onGoDashboard?.() : onOpenAuth?.('login', '/dashboard')
                    }
                    className="hover:text-white cursor-pointer"
                  >
                    Patient Portal
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onGoStaff}
                    className="hover:text-white cursor-pointer"
                  >
                    Staff &amp; Dentist Portal →
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} {CLINIC_INFO.name}. All rights reserved.</p>
            <p>Protected under Republic Act No. 10173 (Data Privacy Act of 2012)</p>
          </div>
        </div>
      </footer>
    </div>
  );
}