import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Home, FileText, Handshake, DollarSign, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import WalkthroughTimeInput from "@/components/WalkthroughTimeInput";

export default function NewDeal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, loading } = useCurrentProfile();
  
  const dealId = searchParams.get("dealId");
  const fromVerify = searchParams.get("fromVerify") === "1";

  // Section 1: Property + Deal Info
  const [propertyAddress, setPropertyAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  // Section 2: Seller Info
  const [sellerName, setSellerName] = useState("");
  const [earnestMoney, setEarnestMoney] = useState("");
  const [numberOfSigners, setNumberOfSigners] = useState("1");
  const [secondSignerName, setSecondSignerName] = useState("");

  // Section 3: Proposed Terms
  const [sellerCommissionType, setSellerCommissionType] = useState("percentage");
  const [sellerCommissionPercentage, setSellerCommissionPercentage] = useState("");
  const [sellerFlatFee, setSellerFlatFee] = useState("");
  const [buyerCommissionType, setBuyerCommissionType] = useState("percentage");
  const [buyerCommissionPercentage, setBuyerCommissionPercentage] = useState("");
  const [buyerFlatFee, setBuyerFlatFee] = useState("");
  const [agreementLength, setAgreementLength] = useState("");

  // Property details (optional)
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [notes, setNotes] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [numberOfStories, setNumberOfStories] = useState("");
  const [hasBasement, setHasBasement] = useState("");
  const [county, setCounty] = useState("");
  const [walkthroughScheduled, setWalkthroughScheduled] = useState(null); // null = not answered, true/false
  const [walkthroughDate, setWalkthroughDate] = useState("");
  const [walkthroughTime, setWalkthroughTime] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const autoFormatDate = (value) => {
    const raw = value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    for (let i = 0; i < raw.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += raw[i];
    }
    return formatted;
  };

  // Load draft from sessionStorage when returning from verification or navigating back (NOT for fresh edits from pipeline)
  useEffect(() => {
    const raw = sessionStorage.getItem('newDealDraft');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (dealId && d.dealId && d.dealId !== dealId) return; // don't mix drafts between different deals
      // If editing a deal and there's no meaningful draft, skip — let DB load handle it
      if (dealId && !fromVerify) return;
      setPropertyAddress(d.propertyAddress || "");
      setCity(d.city || "");
      setState(d.state || "");
      setZip(d.zip || "");
      setCounty(d.county || "");
      setPurchasePrice(d.purchasePrice || "");
      setClosingDate(d.closingDate || "");
      setContractDate(d.contractDate || "");
      setSpecialNotes(d.specialNotes || "");
      setSellerName(d.sellerName || "");
      setEarnestMoney(d.earnestMoney || "");
      setNumberOfSigners(d.numberOfSigners || "1");
      setSecondSignerName(d.secondSignerName || "");
      setSellerCommissionType(d.sellerCommissionType || "percentage");
      setSellerCommissionPercentage(d.sellerCommissionPercentage || "");
      setSellerFlatFee(d.sellerFlatFee || "");
      setBuyerCommissionType(d.buyerCommissionType || "percentage");
      setBuyerCommissionPercentage(d.buyerCommissionPercentage || "");
      setBuyerFlatFee(d.buyerFlatFee || "");
      setAgreementLength(d.agreementLength || "");
      setBeds(d.beds || "");
      setBaths(d.baths || "");
      setSqft(d.sqft || "");
      setPropertyType(d.propertyType || "");
      setNotes(d.notes || "");
      setYearBuilt(d.yearBuilt || "");
      setNumberOfStories(d.numberOfStories || "");
      setHasBasement(d.hasBasement || "");
      if (d.walkthroughScheduled !== undefined && d.walkthroughScheduled !== null) setWalkthroughScheduled(d.walkthroughScheduled);
      if (d.walkthroughDate) setWalkthroughDate(d.walkthroughDate);
      if (d.walkthroughTime) setWalkthroughTime(d.walkthroughTime);
      setHydrated(true);
    } catch (_) {}
  }, [dealId, fromVerify]);

  // Helper: parse flexible time string into {hours, minutes} in 24h format, or null if empty/unparseable
  // Primary format from WalkthroughTimeInput: "HH:MMAM" or "HH:MMPM" (no space)
  const parseTimeString = (timeStr) => {
    if (!timeStr || !timeStr.trim()) return null;
    const s = timeStr.trim();
    
    // Primary: "HH:MMAM/PM" or "HH:MM AM/PM" (with or without space)
    const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1]), m = parseInt(ampmMatch[2]);
      const isPM = /pm|p\.m\./i.test(ampmMatch[3]);
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return { hours: h, minutes: m };
    }
    
    // Try "HH:MM" (24-hour)
    const milMatch = s.match(/^(\d{1,2}):(\d{2})$/);
    if (milMatch) {
      return { hours: parseInt(milMatch[1]), minutes: parseInt(milMatch[2]) };
    }
    
    return null;
  };

  // Helper: parse flexible date string into {year, month (1-based), day}
  const parseDateString = (dateStr) => {
    if (!dateStr || !dateStr.trim()) return null;
    const s = dateStr.trim();
    
    // Try MM/DD/YYYY or M/D/YYYY
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      return { month: parseInt(slashMatch[1]), day: parseInt(slashMatch[2]), year: parseInt(slashMatch[3]) };
    }
    
    // Try MM-DD-YYYY
    const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
      return { month: parseInt(dashMatch[1]), day: parseInt(dashMatch[2]), year: parseInt(dashMatch[3]) };
    }
    
    // Try YYYY-MM-DD (ISO-like)
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return { month: parseInt(isoMatch[2]), day: parseInt(isoMatch[3]), year: parseInt(isoMatch[1]) };
    }
    
    // Last resort: native Date parse
    const attempt = new Date(s);
    if (!isNaN(attempt.getTime())) {
      return { month: attempt.getMonth() + 1, day: attempt.getDate(), year: attempt.getFullYear() };
    }
    
    return null;
  };

  // Helper: compute walkthrough ISO from date+time strings (handles many formats)
  // If time is not provided/parseable, stores date at midnight (time is "TBD")
  const computeWalkthroughIso = (scheduled, dateStr, timeStr) => {
    if (scheduled !== true || !dateStr) return null;
    try {
      const dateParts = parseDateString(dateStr);
      if (!dateParts) return null;
      const timeParts = parseTimeString(timeStr); // null if no valid time
      const h = timeParts ? timeParts.hours : 0;
      const m = timeParts ? timeParts.minutes : 0;
      const d = new Date(dateParts.year, dateParts.month - 1, dateParts.day, h, m);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {}
    return null;
  };

  // Helper: check if user entered a valid time
  const hasValidTime = (timeStr) => parseTimeString(timeStr) !== null;

  // Auto-save draft on every change so nothing is lost (only when editing or user has typed)
  useEffect(() => {
    const wtIso = computeWalkthroughIso(walkthroughScheduled, walkthroughDate, walkthroughTime);

    const draft = {
      dealId: dealId || null,
      propertyAddress,
      city,
      state,
      zip,
      county,
      purchasePrice,
      closingDate,
      contractDate,
      specialNotes,
      sellerName,
      earnestMoney,
      numberOfSigners,
      secondSignerName,
      sellerCommissionType,
      sellerCommissionPercentage,
      sellerFlatFee,
      buyerCommissionType,
      buyerCommissionPercentage,
      buyerFlatFee,
      agreementLength,
      beds,
      baths,
      sqft,
      propertyType,
      notes,
      yearBuilt,
      numberOfStories,
      hasBasement,
      walkthroughScheduled,
      walkthrough_scheduled: walkthroughScheduled === true,
      walkthroughDate,
      walkthroughTime,
      walkthrough_datetime: wtIso || null
    };
    // For brand new deals (no dealId), only persist if the user actually typed something meaningful
    const isEditing = !!dealId;
    const hasUserInput = [propertyAddress, city, state, zip, county, purchasePrice, closingDate, sellerName, earnestMoney, sellerCommissionPercentage, sellerFlatFee, buyerCommissionPercentage, buyerFlatFee, agreementLength].some(v => (v ?? '').toString().trim().length > 0);
    if ((isEditing && hydrated) || hasUserInput) {
      sessionStorage.setItem('newDealDraft', JSON.stringify(draft));
    }
  }, [dealId, hydrated, propertyAddress, city, state, zip, county, purchasePrice, closingDate, contractDate, specialNotes, sellerName, earnestMoney, numberOfSigners, secondSignerName, sellerCommissionType, sellerCommissionPercentage, sellerFlatFee, buyerCommissionType, buyerCommissionPercentage, buyerFlatFee, agreementLength, beds, baths, sqft, propertyType, notes, yearBuilt, numberOfStories, hasBasement, walkthroughScheduled, walkthroughDate, walkthroughTime]);

  // Load existing deal data if editing (only if no draft present)
  useEffect(() => {
    if (dealId && profile?.id) {
      // Only skip server load if a meaningful draft exists (not an empty placeholder)
      let hasMeaningfulDraft = false;
      const raw = sessionStorage.getItem('newDealDraft');
      if (raw) {
        try {
          const d = JSON.parse(raw);
          const hasUserInput = [
            d.propertyAddress, d.city, d.state, d.zip, d.county, d.purchasePrice, d.closingDate,
            d.sellerName, d.earnestMoney, d.sellerCommissionPercentage, d.sellerFlatFee,
            d.buyerCommissionPercentage, d.buyerFlatFee, d.agreementLength,
            d.beds, d.baths, d.sqft, d.yearBuilt, d.numberOfStories, d.hasBasement, d.propertyType
          ].some(v => (v ?? '').toString().trim().length > 0);
          hasMeaningfulDraft = hasUserInput;
        } catch(_) {}
      }

      const loadDealData = async () => {
        try {
          const deals = await base44.entities.Deal.filter({ id: dealId });
          if (deals.length > 0) {
            const deal = deals[0];
            
            // Normalizers for mapping DB values to form select options
            const normalizePropertyType = (val) => {
              if (!val) return "";
              const s = String(val).trim().toLowerCase();
              const map = {
                "single family": "single_family",
                "single-family": "single_family",
                "sfh": "single_family",
                "single_family": "single_family",
                "multifamily": "multi_family",
                "multi family": "multi_family",
                "multi-family": "multi_family",
                "multi_family": "multi_family",
                "condo": "condo",
                "townhouse": "townhouse",
                "manufactured": "manufactured",
                "mobile": "manufactured",
                "mobile home": "manufactured",
                "land": "land",
                "lot": "land",
                "other": "other"
              };
              return map[s] || (['single_family','multi_family','condo','townhouse','manufactured','land','other'].includes(s) ? s : 'other');
            };
            const normalizeStories = (v) => {
              const s = String(v ?? '').trim();
              if (!s) return "";
              if (s === '3' || s === '3+' || (!isNaN(Number(s)) && Number(s) >= 3)) return '3+';
              if (s === '1' || s.toLowerCase() === 'one') return '1';
              if (s === '2' || s.toLowerCase() === 'two') return '2';
              return s;
            };
            const normalizeBasement = (v) => {
              if (v === null || v === undefined) return "";
              if (typeof v === 'boolean') return v ? 'yes' : 'no';
              const s = String(v).trim().toLowerCase();
              if (["yes","y","true","t","1"].includes(s)) return 'yes';
              if (["no","n","false","f","0"].includes(s)) return 'no';
              return '';
            };

            
            setPropertyAddress(deal.property_address || "");
            setCity(deal.city || "");
            setState(deal.state || "");
            setZip(deal.zip || "");
            setCounty(deal.county || "");
            
            console.log('[NewDeal] Loaded county from deal:', deal.county);
            setPurchasePrice(deal.purchase_price?.toString() || "");
            setClosingDate(deal.key_dates?.closing_date || "");
            setContractDate(deal.key_dates?.contract_date || "");
            
            if (deal.seller_info) {
              setSellerName(deal.seller_info.seller_name || "");
              setEarnestMoney(deal.seller_info.earnest_money?.toString() || "");
              setNumberOfSigners((deal.seller_info.number_of_signers ?? "1").toString());
              setSecondSignerName(deal.seller_info.second_signer_name || "");
            }
            
            if (!notes) setNotes(deal.notes || "");
            if (!specialNotes) setSpecialNotes(deal.special_notes || "");
            setPropertyType(normalizePropertyType(deal.property_type || deal.property_type_name || deal.type || deal.property_details?.property_type || deal.property_details?.type || ""));
            
            if (deal.property_details) {
              setBeds((deal.property_details.beds ?? deal.property_details.bedrooms ?? deal.property_details.bedrooms_total ?? deal.property_details.bdrms)?.toString() || "");
              setBaths((deal.property_details.baths ?? deal.property_details.bathrooms ?? deal.property_details.bathrooms_total ?? deal.property_details.bathrooms_total_integer)?.toString() || "");
              {
                const sqftRaw = deal.property_details.sqft ?? deal.property_details.square_feet ?? deal.property_details.squareFeet ?? deal.property_details.square_footage ?? deal.property_details.living_area ?? deal.property_details.gross_living_area;
                const sqftVal = typeof sqftRaw === 'string' ? sqftRaw.replace(/[^0-9]/g, '') : sqftRaw;
                setSqft((sqftVal ?? '').toString());
              }
              setYearBuilt((deal.property_details.year_built ?? deal.property_details.yearBuilt ?? deal.property_details.built_year)?.toString() || "");
              setNumberOfStories(normalizeStories(deal.property_details.number_of_stories ?? deal.property_details.stories ?? deal.property_details.floors));
              setHasBasement(normalizeBasement(deal.property_details.has_basement ?? deal.property_details.basement ?? deal.property_details.hasBasement ?? deal.property_details.basement_yn));
            } else {
              setBeds((deal.beds ?? deal.bedrooms ?? deal.bedrooms_total)?.toString() || "");
              setBaths((deal.baths ?? deal.bathrooms ?? deal.bathrooms_total ?? deal.bathrooms_total_integer)?.toString() || "");
              {
                const sqftRaw = deal.sqft ?? deal.square_feet ?? deal.squareFeet ?? deal.square_footage ?? deal.living_area ?? deal.gross_living_area;
                const sqftVal = typeof sqftRaw === 'string' ? sqftRaw.replace(/[^0-9]/g, '') : sqftRaw;
                setSqft((sqftVal ?? '').toString());
              }
              setYearBuilt((deal.year_built ?? deal.yearBuilt)?.toString() || "");
              setNumberOfStories(normalizeStories(deal.number_of_stories ?? deal.stories ?? deal.levels ?? deal.floors));
              setHasBasement(normalizeBasement(deal.has_basement ?? deal.basement ?? deal.basement_yn));
            }
            
            // Load terms from Deal entity first, fallback to Room for backward compatibility
            let terms = deal.proposed_terms;
            
            // If not on Deal (or all values null), try loading from Room
            const termsHaveValues = terms && Object.values(terms).some(v => v !== null && v !== undefined && v !== '');
            if (!termsHaveValues) {
              try {
                const rooms = await base44.entities.Room.filter({ deal_id: dealId });
                if (rooms.length > 0 && rooms[0].proposed_terms) {
                  const roomTerms = rooms[0].proposed_terms;
                  const roomHasValues = Object.values(roomTerms).some(v => v !== null && v !== undefined && v !== '');
                  if (roomHasValues) {
                    terms = roomTerms;
                    console.log('[NewDeal] Loaded terms from Room:', terms);
                  }
                }
                
                // Last resort: check the LegalAgreement's exhibit_a_terms (authoritative source)
                const roomTermsHaveValues = terms && Object.values(terms).some(v => v !== null && v !== undefined && v !== '');
                if (!roomTermsHaveValues) {
                  const agreements = await base44.entities.LegalAgreement.filter({ deal_id: dealId });
                  const activeAgreement = agreements.find(a => a.status !== 'voided' && a.status !== 'superseded');
                  if (activeAgreement?.exhibit_a_terms) {
                    const ex = activeAgreement.exhibit_a_terms;
                    terms = {
                      seller_commission_type: ex.seller_commission_type || null,
                      seller_commission_percentage: ex.seller_commission_percentage ?? null,
                      seller_flat_fee: ex.seller_flat_fee ?? null,
                      buyer_commission_type: ex.buyer_commission_type || null,
                      buyer_commission_percentage: ex.buyer_commission_percentage ?? null,
                      buyer_flat_fee: ex.buyer_flat_fee ?? null,
                      agreement_length: ex.agreement_length_days || ex.agreement_length || null,
                    };
                    console.log('[NewDeal] Loaded terms from LegalAgreement exhibit_a_terms:', terms);
                  }
                }
                
                // Migrate terms to Deal entity for future use
                if (terms) {
                  const finalHasValues = Object.values(terms).some(v => v !== null && v !== undefined && v !== '');
                  if (finalHasValues) {
                    await base44.entities.Deal.update(dealId, { proposed_terms: terms });
                    console.log('[NewDeal] Migrated terms to Deal entity');
                  }
                }
              } catch (e) {
                console.error("Failed to load terms from Room/Agreement:", e);
              }
            } else {
              console.log('[NewDeal] Loaded terms from Deal entity:', terms);
            }
            
            // Populate form fields if terms exist
            if (terms) {
              // Normalize DB value 'flat_fee' back to form value 'flat'
              const normType = (t) => t === 'flat_fee' ? 'flat' : (t || 'percentage');
              
              if (terms.seller_commission_type) {
                setSellerCommissionType(normType(terms.seller_commission_type));
              }
              if (terms.seller_commission_percentage !== null && terms.seller_commission_percentage !== undefined) {
                setSellerCommissionPercentage((terms.seller_commission_percentage ?? "").toString());
              }
              if (terms.seller_flat_fee !== null && terms.seller_flat_fee !== undefined) {
                setSellerFlatFee((terms.seller_flat_fee ?? "").toString());
              }
              
              if (terms.buyer_commission_type) {
                setBuyerCommissionType(normType(terms.buyer_commission_type));
              }
              if (terms.buyer_commission_percentage !== null && terms.buyer_commission_percentage !== undefined) {
                setBuyerCommissionPercentage((terms.buyer_commission_percentage ?? "").toString());
              }
              if (terms.buyer_flat_fee !== null && terms.buyer_flat_fee !== undefined) {
                setBuyerFlatFee((terms.buyer_flat_fee ?? "").toString());
              }
              
              if (terms.agreement_length !== null && terms.agreement_length !== undefined) {
                setAgreementLength((terms.agreement_length ?? "").toString());
              }
            }

            // Hydrate walkthrough fields from deal
            if (deal.walkthrough_scheduled !== undefined && deal.walkthrough_scheduled !== null) {
              setWalkthroughScheduled(deal.walkthrough_scheduled);
            }
            if (deal.walkthrough_datetime) {
              const dt = new Date(deal.walkthrough_datetime);
              setWalkthroughDate(String(dt.getMonth()+1).padStart(2,'0') + '/' + String(dt.getDate()).padStart(2,'0') + '/' + dt.getFullYear());
              const hrs = dt.getHours();
              const mins = String(dt.getMinutes()).padStart(2,'0');
              const ampm = hrs >= 12 ? 'PM' : 'AM';
              const h12 = hrs % 12 || 12;
              // Strict format: no space before AM/PM (e.g. "02:30PM")
              setWalkthroughTime(String(h12).padStart(2,'0') + ':' + mins + ampm);
            }

            // Fallback: if property details are still empty, try server-normalized details
            const detailsEmpty = !propertyType && !beds && !baths && !sqft && !yearBuilt && !numberOfStories && !hasBasement;
            if (detailsEmpty) {
              try {
                const resp = await base44.functions.invoke('getDealDetailsForUser', { dealId });
                const d = resp?.data?.deal || resp?.data;
                const pd = d?.property_details || d?.propertyDetails;
                const pt = d?.property_type || d?.propertyType || pd?.property_type || pd?.type;
                setPropertyType(normalizePropertyType(pt || ""));
                if (pd) {
                  setBeds((pd.beds ?? pd.bedrooms ?? pd.bedrooms_total ?? pd.bdrms)?.toString() || "");
                  setBaths((pd.baths ?? pd.bathrooms ?? pd.bathrooms_total ?? pd.bathrooms_total_integer)?.toString() || "");
                  const sqftRaw2 = pd.sqft ?? pd.square_feet ?? pd.squareFeet ?? pd.square_footage ?? pd.living_area ?? pd.gross_living_area;
                  const sqftVal2 = typeof sqftRaw2 === 'string' ? sqftRaw2.replace(/[^0-9]/g, '') : sqftRaw2;
                  setSqft((sqftVal2 ?? '').toString());
                  setYearBuilt((pd.year_built ?? pd.yearBuilt ?? pd.built_year)?.toString() || "");
                  setNumberOfStories(normalizeStories(pd.number_of_stories ?? pd.stories ?? pd.floors));
                  setHasBasement(normalizeBasement(pd.has_basement ?? pd.basement ?? pd.hasBasement ?? pd.basement_yn));
                }
              } catch (e) {
                console.warn('[NewDeal] Fallback details load failed', e);
              }
            }

            setHydrated(true);
          }
        } catch (error) {
          console.error("Failed to load deal:", error);
        }
      };
      loadDealData();
    }
  }, [dealId, profile?.id]);

  const handleContinue = async () => {
    if (submitting) return;
    
    // Validation - All fields required except special notes and county
    if (!propertyAddress.trim()) {
      toast.error("Please enter a property address");
      return;
    }
    if (!city.trim()) {
      toast.error("Please enter a city");
      return;
    }
    if (!state.trim()) {
      toast.error("Please enter a state");
      return;
    }
    if (!zip.trim()) {
      toast.error("Please enter a ZIP code");
      return;
    }
    
    const cleanedPrice = String(purchasePrice || '').replace(/[$,\s]/g, '').trim();
    if (!cleanedPrice || isNaN(Number(cleanedPrice)) || Number(cleanedPrice) <= 0) {
      toast.error("Please enter a valid purchase price");
      return;
    }
    
    if (!closingDate) {
      toast.error("Please select a target closing date");
      return;
    }
    
    if (!sellerName.trim()) {
      toast.error("Please enter the seller name");
      return;
    }
    if (!earnestMoney.trim()) {
      toast.error("Please enter the earnest money amount");
      return;
    }
    
    if (sellerCommissionType === "percentage" && !sellerCommissionPercentage.trim()) {
      toast.error("Please enter the seller's agent commission percentage");
      return;
    }
    if (sellerCommissionType === "flat" && !sellerFlatFee.trim()) {
      toast.error("Please enter the seller's agent flat fee");
      return;
    }
    
    if (buyerCommissionType === "percentage" && !buyerCommissionPercentage.trim()) {
      toast.error("Please enter the buyer's agent commission percentage");
      return;
    }
    if (buyerCommissionType === "flat" && !buyerFlatFee.trim()) {
      toast.error("Please enter the buyer's agent flat fee");
      return;
    }
    
    if (!agreementLength.trim()) {
      toast.error("Please enter the agreement length");
      return;
    }

    // Validate walkthrough time is complete if scheduled
    if (walkthroughScheduled === true) {
      if (!walkthroughDate || walkthroughDate.length < 10) {
        toast.error("Please enter a complete walk-through date (MM/DD/YYYY)");
        return;
      }
      if (walkthroughTime && !/^\d{2}:\d{2}(AM|PM)$/.test(walkthroughTime)) {
        toast.error("Please enter a complete walk-through time (e.g. 02:30PM)");
        return;
      }
    }

    setSubmitting(true);

    try {
    // If editing existing deal, save all data to Deal entity immediately
    if (dealId) {
        console.log('[NewDeal] Saving county to deal:', county);
        
        await base44.entities.Deal.update(dealId, {
          property_address: propertyAddress,
          city: city,
          state: state,
          zip: zip,
          county: county || null,
          purchase_price: Number(cleanedPrice),
          key_dates: {
            closing_date: closingDate,
            contract_date: contractDate
          },
          special_notes: specialNotes,
          property_type: propertyType || null,
          property_details: {
            ...(beds ? { beds: Number(beds) } : {}),
            ...(baths ? { baths: Number(baths) } : {}),
            ...(sqft ? { sqft: Number(sqft) } : {}),
            ...(yearBuilt ? { year_built: Number(yearBuilt) } : {}),
            ...(numberOfStories ? { number_of_stories: numberOfStories } : {}),
            ...(hasBasement ? { has_basement: hasBasement === 'yes' } : {})
          },
          seller_info: {
            seller_name: sellerName,
            earnest_money: earnestMoney ? Number(earnestMoney) : null,
            number_of_signers: numberOfSigners,
            second_signer_name: secondSignerName
          },
          proposed_terms: {
            seller_commission_type: sellerCommissionType === 'flat' ? 'flat_fee' : sellerCommissionType,
            seller_commission_percentage: sellerCommissionPercentage ? Number(sellerCommissionPercentage) : null,
            seller_flat_fee: sellerFlatFee ? Number(sellerFlatFee) : null,
            buyer_commission_type: buyerCommissionType === 'flat' ? 'flat_fee' : buyerCommissionType,
            buyer_commission_percentage: buyerCommissionPercentage ? Number(buyerCommissionPercentage) : null,
            buyer_flat_fee: buyerFlatFee ? Number(buyerFlatFee) : null,
            agreement_length: agreementLength ? Number(agreementLength) : null
          },
          walkthrough_scheduled: walkthroughScheduled === true ? true : walkthroughScheduled === false ? false : null,
          walkthrough_datetime: computeWalkthroughIso(walkthroughScheduled, walkthroughDate, walkthroughTime)
        });
        
        // Sync DealAppointments so the Appointments tab reflects walkthrough from New Deal form
        if (walkthroughScheduled === true) {
          try {
            const wtIso = computeWalkthroughIso(walkthroughScheduled, walkthroughDate, walkthroughTime);
            if (wtIso) {
              const apptRows = await base44.entities.DealAppointments.filter({ dealId });
              const apptPatch = {
                walkthrough: {
                  status: 'PROPOSED',
                  datetime: wtIso,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  locationType: 'ON_SITE',
                  notes: null,
                  updatedByUserId: profile?.id || null,
                  updatedAt: new Date().toISOString()
                }
              };
              if (apptRows?.[0]) {
                await base44.entities.DealAppointments.update(apptRows[0].id, apptPatch);
              } else {
                await base44.entities.DealAppointments.create({
                  dealId,
                  ...apptPatch,
                  inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
                  rescheduleRequests: []
                });
              }
            }
          } catch (apptErr) {
            console.warn('[NewDeal] Failed to sync DealAppointments:', apptErr);
          }
        }

        // Also update Room agent_terms if it exists
        const rooms = await base44.entities.Room.filter({ deal_id: dealId });
        if (rooms.length > 0) {
          const room = rooms[0];
          const newTerms = {
            seller_commission_type: sellerCommissionType === 'flat' ? 'flat_fee' : sellerCommissionType,
            seller_commission_percentage: sellerCommissionPercentage ? Number(sellerCommissionPercentage) : null,
            seller_flat_fee: sellerFlatFee ? Number(sellerFlatFee) : null,
            buyer_commission_type: buyerCommissionType === 'flat' ? 'flat_fee' : buyerCommissionType,
            buyer_commission_percentage: buyerCommissionPercentage ? Number(buyerCommissionPercentage) : null,
            buyer_flat_fee: buyerFlatFee ? Number(buyerFlatFee) : null,
            agreement_length: agreementLength ? Number(agreementLength) : null
          };
          
          // Update each agent's terms in agent_terms object
          const updatedAgentTerms = room.agent_terms || {};
          for (const agentId of Object.keys(updatedAgentTerms)) {
            updatedAgentTerms[agentId] = newTerms;
          }
          
          await base44.entities.Room.update(room.id, {
            agent_terms: updatedAgentTerms
          });
        }
    }

    // Check for duplicate deal (same investor + property address) for NEW deals only
    if (!dealId && profile?.id) {
      const allMyDeals = await base44.entities.Deal.filter({ investor_id: profile.id });
      const normAddr = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const targetAddr = normAddr(propertyAddress);
      const activeDup = allMyDeals.find(d => d.status !== 'archived' && d.status !== 'closed' && normAddr(d.property_address) === targetAddr);
      if (activeDup) {
        toast.error("You already have an active deal for this property address. Please edit the existing deal instead.");
        setSubmitting(false);
        return;
      }
    }

    // Immediately create a room request so the agent sees it right away (if agent already selected)
  try {
    if (dealId) {
      const selectedAgentId = sessionStorage.getItem('selectedAgentId');
      if (selectedAgentId) {
        await base44.functions.invoke('sendDealRequest', { deal_id: dealId, agent_profile_id: selectedAgentId });
      }
    }
  } catch (_) {}

  // Build walkthrough ISO datetime once for reuse
    const walkthroughIso = computeWalkthroughIso(walkthroughScheduled, walkthroughDate, walkthroughTime);

    console.log('[NewDeal] handleContinue saving walkthrough:', { walkthroughScheduled, walkthroughDate, walkthroughTime, walkthroughIso });

    // Save to sessionStorage - include dealId if editing
    sessionStorage.setItem('newDealDraft', JSON.stringify({
      dealId: dealId || null,
      propertyAddress,
      city,
      state,
      zip,
      county,
      purchasePrice,
      closingDate,
      contractDate,
      specialNotes,
      sellerName,
      earnestMoney,
      numberOfSigners,
      secondSignerName,
      sellerCommissionType,
      sellerCommissionPercentage,
      sellerFlatFee,
      buyerCommissionType,
      buyerCommissionPercentage,
      buyerFlatFee,
      agreementLength,
      beds,
      baths,
      sqft,
      propertyType,
      notes,
      yearBuilt,
      numberOfStories,
      hasBasement,
      walkthroughScheduled: walkthroughScheduled === true ? true : walkthroughScheduled === false ? false : null,
      walkthrough_scheduled: walkthroughScheduled === true,
      walkthroughDate,
      walkthroughTime,
      walkthrough_time_tbd: walkthroughScheduled === true && !hasValidTime(walkthroughTime),
      walkthrough_datetime: walkthroughIso || null
    }));

    // Navigate with dealId if editing
    if (dealId) {
      navigate(`${createPageUrl("ContractVerify")}?dealId=${dealId}`);
    } else {
      navigate(createPageUrl("ContractVerify"));
    }
    } catch (e) {
      console.error('[NewDeal] handleContinue error:', e);
      toast.error(e?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-[#808080]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(createPageUrl("Pipeline"))}
            className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </button>
          <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Build Your Deal</h1>
          <p className="text-sm text-[#808080]">Enter your deal details in 3 simple sections</p>
        </div>

        {/* Section 1: Property + Deal Info */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
              <Home className="w-6 h-6 text-[#E3C567]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">1. Property & Deal Info</h2>
              <p className="text-sm text-[#808080]">Basic details about the property</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">
                Property Address *
              </label>
              <AddressAutocomplete
                value={propertyAddress}
                onChange={setPropertyAddress}
                onSelect={(place) => {
                  setPropertyAddress(place.address);
                  setCity(place.city);
                  setState(place.state);
                  setZip(place.zip);
                  setCounty(place.county);
                }}
                placeholder="Start typing an address..."
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">City *</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Phoenix"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">State *</label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="AZ"
                  maxLength={2}
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">ZIP *</label>
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="85001"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Purchase Price *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                  <Input
                    type="text"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="250000"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Target Closing Date *</label>
                <Input
                  type="text"
                  value={closingDate}
                  onChange={(e) => setClosingDate(autoFormatDate(e.target.value))}
                  placeholder="MM/DD/YYYY"
                  maxLength={10}
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Special Notes</label>
              <Textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any additional comments or special conditions..."
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] min-h-[80px]"
              />
            </div>

            {/* Property Details */}
            <div className="pt-4 border-t border-[#1F1F1F]">
              <h3 className="text-sm font-semibold text-[#FAFAFA] mb-3">Property Details</h3>

              {/* Row 1: Property Type, Beds, Baths */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Property Type</label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_family">Single Family</SelectItem>
                      <SelectItem value="multi_family">Multi-Family</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="manufactured">Manufactured</SelectItem>
                      <SelectItem value="land">Land</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Bedrooms</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    placeholder="3"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Bathrooms</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={baths}
                    onChange={(e) => setBaths(e.target.value)}
                    placeholder="2"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>
              </div>

              {/* Row 2: Sq Ft, Year Built, Stories */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Square Footage</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={sqft}
                    onChange={(e) => setSqft(e.target.value)}
                    placeholder="1800"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Year Built</label>
                  <Input
                    type="number"
                    min="1800"
                    max={new Date().getFullYear()}
                    step="1"
                    value={yearBuilt}
                    onChange={(e) => setYearBuilt(e.target.value)}
                    placeholder="1998"
                    className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Stories</label>
                  <Select value={numberOfStories} onValueChange={setNumberOfStories}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3+">3+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Basement */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Basement</label>
                  <Select value={hasBasement} onValueChange={setHasBasement}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Seller Info */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#60A5FA]/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#60A5FA]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">2. Seller Information</h2>
              <p className="text-sm text-[#808080]">Details about the seller and transaction</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text.sm font-medium text-[#FAFAFA] mb-2">Seller / Owner Name *</label>
              <Input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="John Doe"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Earnest Money *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                <Input
                  type="text"
                  value={earnestMoney}
                  onChange={(e) => setEarnestMoney(e.target.value)}
                  placeholder="5000"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Number of Signers *</label>
              <Select value={numberOfSigners} onValueChange={setNumberOfSigners}>
                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Signer</SelectItem>
                  <SelectItem value="2">2 Signers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {numberOfSigners === "2" && (
              <div>
                <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Second Signer Name *</label>
                <Input
                  value={secondSignerName}
                  onChange={(e) => setSecondSignerName(e.target.value)}
                  placeholder="Jane Doe"
                  className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Proposed Terms */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#34D399]/20 rounded-full flex items-center justify-center">
              <Handshake className="w-6 h-6 text-[#34D399]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#FAFAFA]">3. Proposed Agreement Terms</h2>
              <p className="text-sm text-[#808080]">Set commission structure for both agents</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Seller's Agent */}
            <div className="border-b border-[#1F1F1F] pb-6">
              <h3 className="text-lg font-semibold text-[#E3C567] mb-4">Seller's Agent Commission</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission Type *</label>
                  <Select value={sellerCommissionType} onValueChange={setSellerCommissionType}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Purchase Price</SelectItem>
                      <SelectItem value="flat">Flat Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sellerCommissionType === "percentage" ? (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission % *</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={sellerCommissionPercentage}
                        onChange={(e) => setSellerCommissionPercentage(e.target.value)}
                        placeholder="3.0"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] text-sm">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Flat Fee *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                      <Input
                        type="number"
                        value={sellerFlatFee}
                        onChange={(e) => setSellerFlatFee(e.target.value)}
                        placeholder="5000"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Buyer's Agent */}
            <div className="border-b border-[#1F1F1F] pb-6">
              <h3 className="text-lg font-semibold text-[#60A5FA] mb-4">Buyer's Agent Commission</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission Type *</label>
                  <Select value={buyerCommissionType} onValueChange={setBuyerCommissionType}>
                    <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage of Purchase Price</SelectItem>
                      <SelectItem value="flat">Flat Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {buyerCommissionType === "percentage" ? (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Commission % *</label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        value={buyerCommissionPercentage}
                        onChange={(e) => setBuyerCommissionPercentage(e.target.value)}
                        placeholder="3.0"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#808080] text-sm">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Flat Fee *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                      <Input
                        type="number"
                        value={buyerFlatFee}
                        onChange={(e) => setBuyerFlatFee(e.target.value)}
                        placeholder="5000"
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] pl-10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agreement Length */}
            <div className="border-b border-[#1F1F1F] pb-6">
              <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Agreement Length (Days) *</label>
              <Input
                type="number"
                value={agreementLength}
                onChange={(e) => setAgreementLength(e.target.value)}
                placeholder="90"
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
              <p className="text-xs text-[#808080] mt-2">How long will this agreement remain active?</p>
            </div>

            {/* Walk-through Scheduling */}
            <div>
              <label className="block text-sm font-medium text-[#FAFAFA] mb-3">Would you like to schedule a walk-through?</label>
              <p className="text-xs text-[#808080] mb-3">This will send a proposed walk-through to all selected agents. They can accept or decline after signing.</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWalkthroughScheduled(true)}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    walkthroughScheduled === true
                      ? "bg-[#10B981] text-black"
                      : "bg-[#141414] border border-[#1F1F1F] text-[#FAFAFA] hover:border-[#10B981]/50"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => { setWalkthroughScheduled(false); setWalkthroughDate(""); setWalkthroughTime(""); }}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    walkthroughScheduled === false
                      ? "bg-[#F59E0B] text-black"
                      : "bg-[#141414] border border-[#1F1F1F] text-[#FAFAFA] hover:border-[#F59E0B]/50"
                  }`}
                >
                  Not Now
                </button>
              </div>
              {walkthroughScheduled === true && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <div>
                      <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Proposed Date</label>
                      <Input
                        type="text"
                        value={walkthroughDate}
                        onChange={(e) => setWalkthroughDate(autoFormatDate(e.target.value))}
                        placeholder="MM/DD/YYYY"
                        maxLength={10}
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#FAFAFA] mb-2">Proposed Time</label>
                      <WalkthroughTimeInput
                        value={walkthroughTime}
                        onChange={setWalkthroughTime}
                        className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleContinue}
            disabled={submitting}
            className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full px-8 font-semibold"
          >
            {submitting ? "Saving..." : "Continue to Contract Verification"}
            {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </div>
  );
}