export interface PutHashtagsResponse {
  jobOpportunity: string;
  jobLevel: string;
  jobLocal: string;
  jobTitle?: string;
  jobUrl?: string;
  limitDate: string;
  footer: string;
  encerrada: boolean;
}

export interface RetrieveContentResponse {
  jobUrl: string;
  jobTitle: string;
  body: string;
}
