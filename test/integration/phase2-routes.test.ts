import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../helpers/db";
import { sessionService } from "@/server/auth/session";
import { SESSION_COOKIE_NAME } from "@/server/auth/middleware";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { users, categories, locations, artistProfiles } from "@/server/db/schema";
import { getStorageAdapter } from "@/server/providers/storage";

// Route handlers
import { GET as getCategories } from "@/app/api/v1/categories/route";
import { GET as getLocations } from "@/app/api/v1/locations/route";
import { GET as getArtists } from "@/app/api/v1/artists/route";
import { GET as getArtistBySlug } from "@/app/api/v1/artists/[slug]/route";
import { GET as getAvailability } from "@/app/api/v1/artists/[id]/availability/route";
import { POST as postArtistApplication } from "@/app/api/v1/artist-applications/route";
import { GET as getOwnApplication } from "@/app/api/v1/me/artist-application/route";
import { GET as getOwnProfile, PATCH as patchOwnProfile } from "@/app/api/v1/me/artist-profile/route";
import { POST as submitOwnProfile } from "@/app/api/v1/me/artist-profile/submit/route";
import { GET as getPackages, POST as postPackage } from "@/app/api/v1/me/artist-packages/route";
import { PATCH as patchPackage, DELETE as deletePackage } from "@/app/api/v1/me/artist-packages/[id]/route";
import { GET as getShortlist } from "@/app/api/v1/me/shortlist/route";
import {
  GET as getShortlistStatus,
  PUT as putShortlist,
  DELETE as deleteShortlist,
} from "@/app/api/v1/me/shortlist/[artistId]/route";
import { POST as postMediaUpload } from "@/app/api/v1/media/uploads/route";
import { POST as postMediaComplete } from "@/app/api/v1/media/uploads/[id]/complete/route";

describe("Phase 2 Route Handlers Integration Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  async function createAuthContext(phone = "+919876543250") {
    const [user] = await db.insert(users).values({ phone, name: "Test User" }).returning();
    const { token, sessionId } = await sessionService.createSession(user.id);
    const csrfToken = sessionService.generateCsrfToken(sessionId);
    return {
      user,
      token,
      sessionId,
      csrfToken,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        "x-csrf-token": csrfToken,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
    };
  }

  it("serves public catalog endpoints correctly", async () => {
    await db.insert(categories).values([
      { id: "rock", name: "Rock" },
      { id: "jazz", name: "Jazz" },
    ]);
    await db.insert(locations).values([
      { id: "blr", name: "Bengaluru", state: "Karnataka" },
    ]);

    const [artistUser] = await db
      .insert(users)
      .values({ phone: "+919876543251", name: "Rock Band User" })
      .returning();

    const [profile] = await db
      .insert(artistProfiles)
      .values({
        userId: artistUser.id,
        slug: "the-rockers",
        stageName: "The Rockers",
        tagline: "Live rock performers",
        cityId: "blr",
        startingPriceMinor: 2000000,
        publicationState: "published",
      })
      .returning();

    // 1. GET /categories
    const catReq = new NextRequest("http://localhost:3000/api/v1/categories");
    const catRes = await getCategories(catReq);
    expect(catRes.status).toBe(200);
    const catBody = await catRes.json();
    expect(catBody.data).toHaveLength(2);

    // 2. GET /locations
    const locReq = new NextRequest("http://localhost:3000/api/v1/locations");
    const locRes = await getLocations(locReq);
    expect(locRes.status).toBe(200);
    const locBody = await locRes.json();
    expect(locBody.data).toHaveLength(1);

    // 3. GET /artists
    const searchReq = new NextRequest("http://localhost:3000/api/v1/artists?q=Rockers");
    const searchRes = await getArtists(searchReq);
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json();
    expect(searchBody.data.items).toHaveLength(1);
    expect(searchBody.data.items[0].slug).toBe("the-rockers");

    // 4. GET /artists/[slug]
    const slugReq = new NextRequest("http://localhost:3000/api/v1/artists/the-rockers");
    const slugRes = await getArtistBySlug(slugReq, { params: Promise.resolve({ slug: "the-rockers" }) });
    expect(slugRes.status).toBe(200);
    const slugBody = await slugRes.json();
    expect(slugBody.data.stageName).toBe("The Rockers");

    // 5. GET /artists/[id]/availability
    const availReq = new NextRequest(`http://localhost:3000/api/v1/artists/${profile.id}/availability`);
    const availRes = await getAvailability(availReq, { params: Promise.resolve({ id: profile.id }) });
    expect(availRes.status).toBe(200);
    const availBody = await availRes.json();
    expect(availBody.data.isBookable).toBe(true);
  });

  it("handles artist application, profile drafting, and review submission", async () => {
    const auth = await createAuthContext("+919876543252");

    // 1. POST /artist-applications
    const appReq = new NextRequest("http://localhost:3000/api/v1/artist-applications", {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({ notes: "Experienced tabla player." }),
    });
    const appRes = await postArtistApplication(appReq);
    expect(appRes.status).toBe(201);
    const appBody = await appRes.json();
    expect(appBody.data.status).toBe("pending");

    // 2. GET /me/artist-application
    const getAppReq = new NextRequest("http://localhost:3000/api/v1/me/artist-application", {
      headers: auth.headers,
    });
    const getAppRes = await getOwnApplication(getAppReq);
    expect(getAppRes.status).toBe(200);

    // 3. GET /me/artist-profile (auto-creates draft)
    const getProfReq = new NextRequest("http://localhost:3000/api/v1/me/artist-profile", {
      headers: auth.headers,
    });
    const getProfRes = await getOwnProfile(getProfReq);
    expect(getProfRes.status).toBe(200);
    const profBody = await getProfRes.json();
    expect(profBody.data.publicationState).toBe("draft");

    // 4. PATCH /me/artist-profile
    const patchProfReq = new NextRequest("http://localhost:3000/api/v1/me/artist-profile", {
      method: "PATCH",
      headers: auth.headers,
      body: JSON.stringify({
        stageName: "Ustad Zakir Sound",
        startingPriceMinor: 3500000,
      }),
    });
    const patchProfRes = await patchOwnProfile(patchProfReq);
    expect(patchProfRes.status).toBe(200);
    const patchBody = await patchProfRes.json();
    expect(patchBody.data.stageName).toBe("Ustad Zakir Sound");

    // 5. POST /me/artist-profile/submit
    const submitReq = new NextRequest("http://localhost:3000/api/v1/me/artist-profile/submit", {
      method: "POST",
      headers: auth.headers,
    });
    const submitRes = await submitOwnProfile(submitReq);
    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();
    expect(submitBody.data.publicationState).toBe("pending_review");
  });

  it("handles package management with CRUD and soft-deletion", async () => {
    const auth = await createAuthContext("+919876543253");

    // 1. POST /me/artist-packages
    const createPkgReq = new NextRequest("http://localhost:3000/api/v1/me/artist-packages", {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({
        title: "Standard 60m Show",
        durationMinutes: 60,
        feeMinor: 2500000,
      }),
    });
    const createPkgRes = await postPackage(createPkgReq);
    expect(createPkgRes.status).toBe(201);
    const pkgBody = await createPkgRes.json();
    const pkgId = pkgBody.data.id;

    // 2. GET /me/artist-packages
    const getPkgsReq = new NextRequest("http://localhost:3000/api/v1/me/artist-packages", {
      headers: auth.headers,
    });
    const getPkgsRes = await getPackages(getPkgsReq);
    expect(getPkgsRes.status).toBe(200);
    const listBody = await getPkgsRes.json();
    expect(listBody.data).toHaveLength(1);

    // 3. PATCH /me/artist-packages/[id]
    const patchPkgReq = new NextRequest(`http://localhost:3000/api/v1/me/artist-packages/${pkgId}`, {
      method: "PATCH",
      headers: auth.headers,
      body: JSON.stringify({ feeMinor: 3000000 }),
    });
    const patchPkgRes = await patchPackage(patchPkgReq, { params: Promise.resolve({ id: pkgId }) });
    expect(patchPkgRes.status).toBe(200);
    const updatedBody = await patchPkgRes.json();
    expect(updatedBody.data.feeMinor).toBe(3000000);

    // 4. DELETE /me/artist-packages/[id] (archive)
    const delPkgReq = new NextRequest(`http://localhost:3000/api/v1/me/artist-packages/${pkgId}`, {
      method: "DELETE",
      headers: auth.headers,
    });
    const delPkgRes = await deletePackage(delPkgReq, { params: Promise.resolve({ id: pkgId }) });
    expect(delPkgRes.status).toBe(200);

    // 5. Verify no longer in active packages
    const getPkgsAfterDel = await getPackages(getPkgsReq);
    const listAfterBody = await getPkgsAfterDel.json();
    expect(listAfterBody.data).toHaveLength(0);
  });

  it("handles customer shortlist operations", async () => {
    const auth = await createAuthContext("+919876543254");

    const [artistUser] = await db
      .insert(users)
      .values({ phone: "+919876543255", name: "Shortlistable Artist" })
      .returning();

    const [artist] = await db
      .insert(artistProfiles)
      .values({
        userId: artistUser.id,
        slug: "jazz-trio",
        stageName: "Jazz Trio",
        publicationState: "published",
      })
      .returning();

    // 1. PUT /me/shortlist/[artistId]
    const putReq = new NextRequest(`http://localhost:3000/api/v1/me/shortlist/${artist.id}`, {
      method: "PUT",
      headers: auth.headers,
    });
    const putRes = await putShortlist(putReq, { params: Promise.resolve({ artistId: artist.id }) });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.data.isShortlisted).toBe(true);

    // 2. GET /me/shortlist/[artistId]
    const getStatusReq = new NextRequest(`http://localhost:3000/api/v1/me/shortlist/${artist.id}`, {
      headers: auth.headers,
    });
    const getStatusRes = await getShortlistStatus(getStatusReq, {
      params: Promise.resolve({ artistId: artist.id }),
    });
    expect(getStatusRes.status).toBe(200);
    const statusBody = await getStatusRes.json();
    expect(statusBody.data.isShortlisted).toBe(true);

    // 3. GET /me/shortlist
    const getListReq = new NextRequest("http://localhost:3000/api/v1/me/shortlist", {
      headers: auth.headers,
    });
    const getListRes = await getShortlist(getListReq);
    expect(getListRes.status).toBe(200);
    const listBody = await getListRes.json();
    expect(listBody.data.items).toHaveLength(1);
    expect(listBody.data.items[0].artist.slug).toBe("jazz-trio");

    // 4. DELETE /me/shortlist/[artistId]
    const delReq = new NextRequest(`http://localhost:3000/api/v1/me/shortlist/${artist.id}`, {
      method: "DELETE",
      headers: auth.headers,
    });
    const delRes = await deleteShortlist(delReq, { params: Promise.resolve({ artistId: artist.id }) });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.data.isShortlisted).toBe(false);
  });

  it("handles media upload intent and complete verification flow", async () => {
    const auth = await createAuthContext("+919876543256");

    // 1. POST /media/uploads
    const uploadReq = new NextRequest("http://localhost:3000/api/v1/media/uploads", {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({
        fileName: "cover.jpg",
        contentType: "image/jpeg",
        sizeBytes: 800000,
      }),
    });
    const uploadRes = await postMediaUpload(uploadReq);
    expect(uploadRes.status).toBe(201);
    const uploadBody = await uploadRes.json();
    const { assetId, storageKey } = uploadBody.data;

    // 2. Simulate storage binary upload
    const storage = getStorageAdapter();
    (storage as any).simulateUpload(storageKey);

    // 3. POST /media/uploads/[id]/complete
    const completeReq = new NextRequest(`http://localhost:3000/api/v1/media/uploads/${assetId}/complete`, {
      method: "POST",
      headers: auth.headers,
    });
    const completeRes = await postMediaComplete(completeReq, {
      params: Promise.resolve({ id: assetId }),
    });
    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.data.scanState).toBe("clean");
  });
});
