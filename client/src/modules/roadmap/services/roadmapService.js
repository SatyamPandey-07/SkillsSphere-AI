import { apiRequest } from "../../../services/apiClient";

const TOKEN_KEY = "skillssphere.auth.token";
const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export const getMyRoadmap = async () => {
  return await apiRequest("/api/roadmap/me", {
    method: "GET",
    token: getToken(),
  });
};

export const syncRoadmap = async (targetRole, topics) => {
  return await apiRequest("/api/roadmap/sync", {
    method: "POST",
    body: { targetRole, topics },
    token: getToken(),
  });
};

export const updateTopicStatus = async (topicId, status) => {
  return await apiRequest("/api/roadmap/update-topic", {
    method: "PATCH",
    body: { topicId, status },
    token: getToken(),
  });
};
