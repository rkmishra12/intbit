import { clerkClient, requireAuth } from "@clerk/express";
import User from "../models/User.js";
import { upsertStreamUser } from "../lib/stream.js";

export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const clerkId = req.auth().userId;

      if (!clerkId) return res.status(401).json({ message: "Unauthorized - invalid token" });

      // find user in DB by Clerk ID
      let user = await User.findOne({ clerkId });

      // Production-safe fallback: if webhook sync failed/delayed, create user on first authenticated request.
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const primaryEmail =
          clerkUser.emailAddresses?.find((email) => email.id === clerkUser.primaryEmailAddressId)
            ?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress;

        if (!primaryEmail) {
          return res.status(400).json({ message: "Authenticated user does not have a valid email" });
        }

        const fullName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
        const nextUserData = {
          clerkId,
          email: primaryEmail,
          name: fullName || primaryEmail.split("@")[0],
          profileImage: clerkUser.imageUrl || "",
        };

        // Reuse an existing email-matched user record before inserting a new one.
        user = await User.findOne({ email: primaryEmail });

        if (user) {
          user.clerkId = clerkId;
          user.name = nextUserData.name;
          user.profileImage = nextUserData.profileImage;
          await user.save();
        } else {
          user = await User.findOneAndUpdate({ clerkId }, nextUserData, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          });
        }
      }

      // attach user to req
      req.user = user;

      // Keep Stream user state in sync even when webhook delivery is delayed or missed.
      await upsertStreamUser({
        id: user.clerkId.toString(),
        name: user.name,
        image: user.profileImage,
      });

      next();
    } catch (error) {
      console.error("Error in protectRoute middleware", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];
