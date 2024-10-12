import mongoose from "mongoose";
import _sortBy from "lodash/sortBy";
import { EpisodeModel } from "../../../models/episodes.model";
import { s3Functions } from "../../../utils";
import { sortEpisodeTopics, topicContentParser } from "../../_routeUtils";
const ObjectId = mongoose.Types.ObjectId;

export const deleteEpisodeTopic = async (episodeId: string, topicId: string, userId: string) => {
  try {
    const documentBeforeUpdate = await EpisodeModel.findOne({
      _id: new ObjectId(episodeId),
      userId: new ObjectId(userId)
    }).select({
      topics: { $elemMatch: { _id: topicId } }
    });

    if (documentBeforeUpdate?.topics[0].img) {
      await s3Functions.delete(documentBeforeUpdate?.topics[0].img);
    }

    await EpisodeModel.updateMany(
      {
        _id: new ObjectId(episodeId),
        userId: new ObjectId(userId),
        "topics.parentId": topicId,
        "topics.isChild": true
      },
      {
        $set: {
          "topics.$[elem].isChild": false,
          "topics.$[elem].parentId": ""
        }
      },
      {
        arrayFilters: [{ "elem.isChild": true, "elem.parentId": topicId }]
      }
    );

    await EpisodeModel.updateOne(
      {
        _id: new ObjectId(episodeId),
        userId: new ObjectId(userId)
      },
      {
        $pull: { topics: { _id: topicId } }
      }
    );

    const updatedEpisode = await EpisodeModel.findOne({
      _id: new ObjectId(episodeId),
      userId: new ObjectId(userId)
    }).lean();

    return {
      resultStatus: {
        success: true,
        errors: null,
        responseCode: 200,
        resultMessage: "Your request was successful."
      },
      result: {
        topics: updatedEpisode?.topics
          ? sortEpisodeTopics(topicContentParser(updatedEpisode.topics))
          : []
      }
    };
  } catch (error) {
    return {
      resultStatus: {
        success: false,
        errors: error,
        responseCode: 400,
        resultMessage: "Your request failed."
      }
    };
  }
};
